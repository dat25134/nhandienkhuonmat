"""
Delegate listing controller implementing /api/delegates per FE contract
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.models.user import User
from app.models.checkin import Checkin


delegate_bp = Blueprint('delegate', __name__)


def _parse_iso(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        s = ts
        if s.endswith('Z'):
            s = s[:-1] + '+00:00'
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


@delegate_bp.route('/api/delegates', methods=['GET'])
def list_delegates():
    """List delegates with filters, sorting, pagination, stats and meta"""
    try:
        # Query params
        search = request.args.get('search')
        organization_filter = request.args.get('organization')
        status_filter = request.args.get('status', 'all')  # active|inactive|blacklisted|all
        checked_in_filter = request.args.get('checkedIn', 'all')  # all|yes|no
        date_from = request.args.get('dateFrom')
        date_to = request.args.get('dateTo')
        sort_by = request.args.get('sortBy', 'name')
        sort_order = request.args.get('sortOrder', 'asc')
        include_stats = request.args.get('includeStats', 'false').lower() == 'true'

        # Pagination
        try:
            page = int(request.args.get('page', '1'))
        except ValueError:
            page = 1
        page = max(1, page)

        try:
            page_size = int(request.args.get('pageSize', '20'))
        except ValueError:
            page_size = 20
        if page_size not in [10, 20, 50, 100]:
            page_size = 20

        # Load users and checkins
        users = User.load_all()
        checkins = Checkin.load_all()

        # Build helper maps for last checkin time and total checkins
        user_id_to_checkins: Dict[int, List[Any]] = {}
        for c in checkins:
            if c.user_id is None:
                continue
            user_id_to_checkins.setdefault(c.user_id, []).append(c)

        def compute_last_and_total(uid: int) -> (Optional[str], int, int):
            # returns (lastCheckinTime, totalCheckins, checkedInTodayFlag)
            items = user_id_to_checkins.get(uid, [])
            if not items:
                return None, 0, 0
            # last by checked_at
            items_sorted = sorted(items, key=lambda x: x.checked_at or '', reverse=True)
            last_time = items_sorted[0].checked_at

            # checked in today (UTC date)
            today = datetime.utcnow().strftime('%Y-%m-%d')
            checked_today = 0
            for it in items:
                if it.checked_at and it.checked_at.split('T')[0] == today:
                    checked_today = 1
                    break
            return last_time, len(items), checked_today

        # Derive status for delegates: we don't have explicit status fields, so default all active
        # If needed later, can be extended by reading from a blacklist/inactive source
        def derive_status_for_user(u: User) -> str:
            # default to active; extendable via notes or future flags
            note = (u.notes or '').lower()
            if 'blacklist' in note or 'blacklisted' in note:
                return 'blacklisted'
            if 'inactive' in note or 'deactivate' in note:
                return 'inactive'
            return 'active'

        # Build delegate items
        items: List[Dict[str, Any]] = []
        for u in users:
            last_checkin, total_checkins, checked_today_flag = compute_last_and_total(u.id)
            status_value = derive_status_for_user(u)
            item = {
                'id': str(u.id) if u.id is not None else '',
                'code': None,  # placeholder, can map from seat_number or custom code if needed
                'name': u.name or '',
                'organization': u.company or '',
                'position': u.position or None,
                'avatar': u.avatar or None,
                'email': u.email or None,
                'phone': u.phone or None,
                'badgeId': u.seat_number or None,
                'registeredAt': u.created_at or None,
                'lastCheckinTime': last_checkin,
                'totalCheckins': total_checkins,
                'status': status_value,
                'notes': u.notes or None,
                '_checkedToday': checked_today_flag
            }
            items.append(item)

        # Filters
        if search:
            s = search.strip().lower()
            items = [it for it in items if (
                s in (it['name'] or '').lower() or
                s in (it['email'] or '').lower() or
                s in (it['phone'] or '').lower() or
                s in (it['id'] or '').lower() or
                s in (it['badgeId'] or '').lower()
            )]

        if organization_filter:
            org = organization_filter.strip().lower()
            items = [it for it in items if org in (it['organization'] or '').lower()]

        if status_filter in ['active', 'inactive', 'blacklisted']:
            items = [it for it in items if it['status'] == status_filter]

        # Date range applies to registeredAt when provided
        from_dt = _parse_iso(date_from)
        to_dt = _parse_iso(date_to)
        if from_dt or to_dt:
            filtered: List[Dict[str, Any]] = []
            for it in items:
                rt = _parse_iso(it['registeredAt'])
                if rt is None:
                    continue
                ok = True
                if from_dt and rt < from_dt:
                    ok = False
                if to_dt and rt > to_dt:
                    ok = False
                if ok:
                    filtered.append(it)
            items = filtered

        # checkedIn filter: yes = checked today, no = not checked today
        if checked_in_filter == 'yes':
            items = [it for it in items if it['_checkedToday'] == 1]
        elif checked_in_filter == 'no':
            items = [it for it in items if it['_checkedToday'] == 0]

        # Sorting
        valid_sort = ['name', 'organization', 'lastCheckinTime', 'registeredAt', 'totalCheckins']
        sort_key = sort_by if sort_by in valid_sort else 'name'

        def sort_key_fn(it: Dict[str, Any]):
            if sort_key == 'name':
                return (it['name'] or '').lower()
            if sort_key == 'organization':
                return (it['organization'] or '').lower()
            if sort_key == 'lastCheckinTime':
                ts = _parse_iso(it['lastCheckinTime'])
                return ts or datetime.min.replace(tzinfo=timezone.utc)
            if sort_key == 'registeredAt':
                ts = _parse_iso(it['registeredAt'])
                return ts or datetime.min.replace(tzinfo=timezone.utc)
            if sort_key == 'totalCheckins':
                return it['totalCheckins']
            return 0

        reverse = (sort_order.lower() == 'desc')
        items.sort(key=sort_key_fn, reverse=reverse)

        # Stats (pre-pagination)
        total_items = len(items)
        stats_obj: Optional[Dict[str, Any]] = None
        if include_stats:
            active_count = sum(1 for it in items if it['status'] == 'active')
            inactive_count = sum(1 for it in items if it['status'] == 'inactive')
            blacklisted_count = sum(1 for it in items if it['status'] == 'blacklisted')
            checked_in_today = sum(1 for it in items if it['_checkedToday'] == 1)
            unique_orgs = len({it['organization'] for it in items if it['organization']})
            stats_obj = {
                'total': total_items,
                'active': active_count,
                'inactive': inactive_count,
                'blacklisted': blacklisted_count,
                'checkedInToday': checked_in_today,
                'uniqueOrganizations': unique_orgs
            }

        # Pagination
        total_pages = (total_items + page_size - 1) // page_size if page_size else 1
        if total_pages == 0:
            total_pages = 1
        if page > total_pages:
            page = total_pages
        start = (page - 1) * page_size
        end = start + page_size
        page_items = items[start:end]

        # Strip helper field
        for it in page_items:
            it.pop('_checkedToday', None)

        pagination_obj = {
            'page': page,
            'pageSize': page_size,
            'totalItems': total_items,
            'totalPages': total_pages,
            'hasNext': page < total_pages,
            'hasPrev': page > 1
        }

        server_time = datetime.utcnow().isoformat() + 'Z'
        meta_obj = {
            'serverTime': server_time,
            'filtersEcho': {
                'search': search if search is not None else None,
                'organization': organization_filter if organization_filter else None,
                'status': status_filter if status_filter in ['all', 'active', 'inactive', 'blacklisted'] else 'all',
                'checkedIn': checked_in_filter if checked_in_filter in ['all', 'yes', 'no'] else 'all',
                'dateFrom': date_from if date_from else None,
                'dateTo': date_to if date_to else None
            }
        }

        response_obj = {
            'items': page_items,
            'pagination': pagination_obj,
            'meta': meta_obj
        }
        if include_stats:
            response_obj['stats'] = stats_obj

        return jsonify(response_obj)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Error loading delegates: {str(e)}'
            }
        }), 500


def _user_to_delegate_detail(u: User, checkins: List[Checkin]) -> Dict[str, Any]:
    # Aggregate checkin info
    user_checkins = [c for c in checkins if c.user_id == u.id]
    last_time = None
    total = 0
    if user_checkins:
        user_checkins.sort(key=lambda x: x.checked_at or '', reverse=True)
        last_time = user_checkins[0].checked_at
        total = len(user_checkins)

    # Derive status similar to list endpoint
    note = (u.notes or '').lower()
    if 'blacklist' in note or 'blacklisted' in note:
        status_value = 'blacklisted'
    elif 'inactive' in note or 'deactivate' in note:
        status_value = 'inactive'
    elif 'pending' in note:
        status_value = 'pending'
    else:
        status_value = 'active'

    # trainingImageUrls from user.images (map to media URLs if needed)
    training_urls = []
    for img in (u.images or []):
        # If already url-like, keep; else try to map to /api/media/images/...
        if isinstance(img, str) and (img.startswith('http://') or img.startswith('https://') or img.startswith('/')):
            training_urls.append(img)
        else:
            training_urls.append(f"/api/media/images/{img}")

    return {
        'id': str(u.id) if u.id is not None else '',
        'code': None,
        'name': u.name or '',
        'organization': u.company or '',
        'position': u.position or None,
        'email': u.email or None,
        'phone': u.phone or None,
        'avatar': u.avatar or None,
        'trainingImageUrls': training_urls,
        'badgeId': u.seat_number or None,
        'registeredAt': u.created_at or None,
        'lastCheckinTime': last_time,
        'totalCheckins': total,
        'status': status_value,
        'notes': u.notes or None
    }


@delegate_bp.route('/api/delegates/<id>', methods=['GET'])
def get_delegate_detail(id: str):
    try:
        # Convert id to int if numeric
        try:
            uid = int(id)
        except ValueError:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'VALIDATION_ERROR',
                    'message': 'Invalid delegate id'
                }
            }), 400

        user = User.get_by_id(uid)
        if not user:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'NOT_FOUND',
                    'message': 'Delegate not found'
                }
            }), 404

        checkins = Checkin.load_all()
        detail = _user_to_delegate_detail(user, checkins)
        return jsonify(detail)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': f'Error getting delegate: {str(e)}'
            }
        }), 500


def _validate_patch_payload(payload: Dict[str, Any]) -> Optional[str]:
    # Disallow trainingImageUrls in patch payload
    if 'trainingImageUrls' in payload:
        return 'trainingImageUrls is not allowed in PATCH payload'

    # name and organization length if provided
    name = payload.get('name')
    if name is not None and not (1 <= len(name) <= 128):
        return 'name must be 1..128 characters'
    organization = payload.get('organization')
    if organization is not None and not (1 <= len(organization) <= 128):
        return 'organization must be 1..128 characters'

    # email basic format
    email = payload.get('email')
    if email is not None and email != '':
        if '@' not in email or '.' not in email.split('@')[-1]:
            return 'email format is invalid'

    # phone allow +, digits, spaces
    phone = payload.get('phone')
    if phone is not None and phone != '':
        import re
        if not re.fullmatch(r"[+\d\s-]+", phone):
            return 'phone format is invalid'

    # status enum
    status = payload.get('status')
    if status is not None and status not in ['active', 'inactive', 'blacklisted', 'pending']:
        return 'status is invalid'

    return None


@delegate_bp.route('/api/delegates/<id>', methods=['PATCH'])
def update_delegate(id: str):
    try:
        try:
            uid = int(id)
        except ValueError:
            return jsonify({'success': False, 'error': {'code': 'VALIDATION_ERROR', 'message': 'Invalid delegate id'}}), 400

        user = User.get_by_id(uid)
        if not user:
            return jsonify({'success': False, 'error': {'code': 'NOT_FOUND', 'message': 'Delegate not found'}}), 404

        payload = request.get_json(silent=True) or {}
        err = _validate_patch_payload(payload)
        if err:
            return jsonify({'success': False, 'error': {'code': 'VALIDATION_ERROR', 'message': err}}), 400

        # Apply partial updates
        if 'name' in payload:
            user.name = payload['name'] or ''
        if 'organization' in payload:
            user.company = payload['organization'] or ''
        if 'position' in payload:
            user.position = payload['position'] or ''
        if 'email' in payload:
            user.email = payload['email'] or ''
        if 'phone' in payload:
            user.phone = payload['phone'] or ''
        if 'badgeId' in payload:
            user.seat_number = payload['badgeId'] or ''
        if 'notes' in payload:
            user.notes = payload['notes'] or ''
        if 'status' in payload:
            # Store status marker in notes to keep JSON model simple (as not to change model schema for now)
            # Clean previous markers and append new status tag
            base_note = (user.notes or '')
            for marker in ['[status:active]', '[status:inactive]', '[status:blacklisted]', '[status:pending]']:
                base_note = base_note.replace(marker, '').strip()
            user.notes = (base_note + f" [status:{payload['status']}]").strip()

        user.save()

        checkins = Checkin.load_all()
        detail = _user_to_delegate_detail(user, checkins)
        return jsonify(detail)
    except Exception as e:
        return jsonify({'success': False, 'error': {'code': 'INTERNAL_ERROR', 'message': f'Error updating delegate: {str(e)}'}}), 500


@delegate_bp.route('/api/delegates/<id>', methods=['DELETE'])
def delete_delegate(id: str):
    try:
        try:
            uid = int(id)
        except ValueError:
            return jsonify({'success': False, 'error': {'code': 'VALIDATION_ERROR', 'message': 'Invalid delegate id'}}), 400

        user = User.get_by_id(uid)
        if not user:
            return jsonify({'success': False, 'error': {'code': 'NOT_FOUND', 'message': 'Delegate not found'}}), 404

        # Delete user
        user.delete()
        return jsonify({'success': True, 'deletedId': str(uid)})
    except Exception as e:
        return jsonify({'success': False, 'error': {'code': 'INTERNAL_ERROR', 'message': f'Error deleting delegate: {str(e)}'}}), 500


