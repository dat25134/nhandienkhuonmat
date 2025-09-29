"""
Checkin controller for face recognition system
"""
from flask import Blueprint, request, jsonify, send_from_directory, send_file
from datetime import datetime, timedelta
import csv
import io
import os
from typing import List, Dict, Any, Optional, Tuple
from app.models.checkin import Checkin
from app.models.user import User
from app.utils.helpers import sanitize_text, normalize_phone

checkin_bp = Blueprint('checkin', __name__)


@checkin_bp.route('/api/checkin/<int:user_id>', methods=['POST'])
def checkin_user(user_id):
    """Check-in user by ID (overwrites previous checkin for same user)"""
    try:
        # Get user data from users.json
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'User not found'
                }
            }), 404
        
        # Create checkin with user data synchronized
        checkin = Checkin(
            user_id=user_id,
            name=user.name,
            phone=user.phone,
            gender=user.gender,
            company=user.company,
            department=user.department,
            position=user.position,
            seat_number=user.seat_number,
            email=user.email,
            avatar=user.avatar,
            notes=user.notes,
            method='manual'
        )
        
        # Save checkin (this will auto-assign ID)
        checkin.save()
        
        return jsonify({
            'status': 'ok', 
            'checked_at': checkin.checked_at,
            'user_id': user_id,
            'name': user.name,
            'checkin_id': checkin.id
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Checkin error: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/checkins', methods=['GET'])
def get_checkins():
    """List checkins with filters, sorting, pagination, stats and meta as contract"""
    try:
        # Query params
        search = request.args.get('search')
        status = request.args.get('status', 'all')
        date_from = request.args.get('dateFrom')
        date_to = request.args.get('dateTo')
        sort_by = request.args.get('sortBy', 'checkinTime')
        sort_order = request.args.get('sortOrder', 'desc')
        include_stats = request.args.get('includeStats', 'false').lower() == 'true'

        # Pagination params with validation
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

        # Load all
        all_checkins = Checkin.load_all()

        # Helper: map to contract item and derive status
        def derive_status(method: Optional[str], confidence: Optional[float]) -> str:
            if method == 'manual':
                return 'manual'
            if confidence is None:
                return 'failed'
            return 'success' if confidence >= 0.8 else 'failed'

        def to_contract_item(c) -> Dict[str, Any]:
            derived_status = derive_status(c.method, c.confidence)
            return {
                'id': str(c.id) if c.id is not None else '',
                'delegateId': str(c.user_id) if c.user_id is not None else '',
                'delegateName': c.name or '',
                'organization': c.company or '',
                'position': c.position or '',
                'avatar': c.avatar or None,
                'checkinTime': c.checked_at or '',
                'confidence': float(c.confidence) if c.confidence is not None else None,
                'status': derived_status,
                'location': None,
                'notes': c.notes or None
            }

        # Convert to dict list early for filtering/sorting
        items: List[Dict[str, Any]] = [to_contract_item(c) for c in all_checkins]

        # Date parsing helper
        def parse_iso(ts: Optional[str]) -> Optional[datetime]:
            if not ts:
                return None
            try:
                # Accept strings like '2024-01-20T08:15:00Z' or ISO with Z
                if ts.endswith('Z'):
                    ts = ts[:-1] + '+00:00'
                return datetime.fromisoformat(ts)
            except Exception:
                return None

        # Apply filters
        if search:
            s = search.strip().lower()
            items = [it for it in items if s in (it['delegateName'] or '').lower() or s in (it['organization'] or '').lower()]

        if status in ['success', 'failed', 'manual']:
            items = [it for it in items if it['status'] == status]

        from_dt = parse_iso(date_from)
        to_dt = parse_iso(date_to)
        if from_dt or to_dt:
            filtered: List[Dict[str, Any]] = []
            for it in items:
                ct = parse_iso(it['checkinTime'])
                if ct is None:
                    continue
                ok = True
                if from_dt and ct < from_dt:
                    ok = False
                if to_dt and ct > to_dt:
                    ok = False
                if ok:
                    filtered.append(it)
            items = filtered

        # Sorting
        sort_key = 'checkinTime'
        if sort_by in ['checkinTime', 'confidence', 'delegateName']:
            sort_key = sort_by

        def sort_key_fn(it: Dict[str, Any]):
            if sort_key == 'checkinTime':
                ts = parse_iso(it['checkinTime'])
                return ts or datetime.min
            if sort_key == 'confidence':
                return it['confidence'] if it['confidence'] is not None else -1.0
            if sort_key == 'delegateName':
                return (it['delegateName'] or '').lower()
            return 0

        reverse = (sort_order.lower() == 'desc')
        items.sort(key=sort_key_fn, reverse=reverse)

        # Stats (computed on filtered set before pagination)
        total_items = len(items)
        stats_obj: Optional[Dict[str, Any]] = None
        if include_stats:
            success_count = sum(1 for it in items if it['status'] == 'success')
            failed_count = sum(1 for it in items if it['status'] == 'failed')
            manual_count = sum(1 for it in items if it['status'] == 'manual')
            unique_delegates = len({it['delegateId'] for it in items if it['delegateId']})
            confidences = [it['confidence'] for it in items if isinstance(it['confidence'], (int, float))]
            avg_conf = (sum(confidences) / len(confidences)) if confidences else 0.0
            stats_obj = {
                'total': total_items,
                'success': success_count,
                'failed': failed_count,
                'manual': manual_count,
                'uniqueDelegates': unique_delegates,
                'avgConfidence': round(avg_conf, 6)
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

        pagination_obj = {
            'page': page,
            'pageSize': page_size,
            'totalItems': total_items,
            'totalPages': total_pages,
            'hasNext': page < total_pages,
            'hasPrev': page > 1
        }

        # Meta
        server_time = datetime.utcnow().isoformat() + 'Z'
        meta_obj = {
            'serverTime': server_time,
            'filtersEcho': {
                'search': search if search is not None else None,
                'status': status if status in ['all', 'success', 'failed', 'manual'] else 'all',
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
                'message': f'Error loading checkins: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/checkins/clear', methods=['POST'])
def clear_checkins():
    """Clear all checkins"""
    try:
        Checkin.clear_all()
        return jsonify({
            'success': True,
            'message': 'Đã xóa toàn bộ checkins',
            'cleared': True
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Error clearing checkins: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/manual-checkin', methods=['POST'])
def manual_checkin():
    """Manual checkin by user_id with duplicate check"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'Thiếu user_id'
                }
            }), 400
        
        # Check if user exists
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({
                'success': False,
                'error': {
                    'message': 'Không tìm thấy người dùng'
                }
            }), 404
        
        # Check if already checked in today
        existing_checkin = Checkin.get_today_checkin(user_id)
        if existing_checkin:
            return jsonify({
                'error': 'Khách đã checkin',
                'message': f'{user.name} đã check-in lúc {existing_checkin.checked_at}',
                'checked_at': existing_checkin.checked_at
            }), 400
        
        # Create new checkin
        checkin = Checkin(
            user_id=user_id,
            name=user.name,
            phone=user.phone,
            gender=user.gender,
            company=user.company,
            department=user.department,
            position=user.position,
            seat_number=user.seat_number,
            email=user.email,
            avatar=user.avatar,
            notes=user.notes,
            method='manual'
        )
        
        # Save checkin (this will auto-assign ID)
        checkin.save()
        
        return jsonify({
            'success': True,
            'message': f'Check-in thành công cho {user.name}',
            'checkin': checkin.to_dict()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Lỗi checkin thủ công: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/checkin-status/<int:user_id>', methods=['GET'])
def check_checkin_status(user_id):
    """Check checkin status for user"""
    try:
        checkin = Checkin.get_by_user_id(user_id)
        
        if checkin:
            return jsonify({
                'checked_in': True,
                'checkin_time': checkin.checked_at,
                'name': checkin.name,
                'method': checkin.method
            })
        
        return jsonify({'checked_in': False, 'checkin_time': None})
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Lỗi kiểm tra trạng thái check-in: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/checkins/fix-ids', methods=['POST'])
def fix_checkin_ids():
    """Fix checkins with null IDs"""
    try:
        Checkin.fix_null_ids()
        return jsonify({
            'success': True,
            'message': 'Đã sửa các ID null trong checkins'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Error fixing IDs: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/users/search', methods=['GET'])
def search_users():
    """Search users for manual checkin"""
    try:
        query = request.args.get('q', '').lower()
        users = User.get_all()
        
        if query:
            # Search by name, phone, company, seat_number
            filtered_users = [u for u in users if 
                            query in u.name.lower() or
                            query in u.phone.lower() or
                            query in u.company.lower() or
                            query in u.seat_number.lower()]
        else:
            filtered_users = users
        
        # Return only necessary info for checkin
        result = []
        for user in filtered_users:
            result.append({
                'id': user.id,
                'name': user.name,
                'phone': user.phone,
                'company': user.company,
                'department': user.department,
                'position': user.position,
                'gender': user.gender,
                'seat_number': user.seat_number
            })
        
        return jsonify({'users': result})
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Lỗi tìm kiếm users: {str(e)}'
            }
        }), 500


# --- Export endpoints ---

def _filter_sort_items_for_export(args) -> List[Dict[str, Any]]:
    """Reuse the same filtering/sorting logic as list endpoint for export (without pagination)."""
    # We call the same sequence as in get_checkins, but encapsulated
    search = args.get('search')
    status = args.get('status', 'all')
    date_from = args.get('dateFrom')
    date_to = args.get('dateTo')
    sort_by = args.get('sortBy', 'checkinTime')
    sort_order = args.get('sortOrder', 'desc')

    all_checkins = Checkin.load_all()

    def derive_status(method: Optional[str], confidence: Optional[float]) -> str:
        if method == 'manual':
            return 'manual'
        if confidence is None:
            return 'failed'
        return 'success' if confidence >= 0.8 else 'failed'

    def to_contract_item(c) -> Dict[str, Any]:
        derived_status = derive_status(c.method, c.confidence)
        return {
            'id': str(c.id) if c.id is not None else '',
            'delegateId': str(c.user_id) if c.user_id is not None else '',
            'delegateName': c.name or '',
            'organization': c.company or '',
            'position': c.position or '',
            'avatar': c.avatar or None,
            'checkinTime': c.checked_at or '',
            'confidence': float(c.confidence) if c.confidence is not None else None,
            'status': derived_status,
            'location': None,
            'notes': c.notes or None
        }

    items: List[Dict[str, Any]] = [to_contract_item(c) for c in all_checkins]

    def parse_iso(ts: Optional[str]) -> Optional[datetime]:
        if not ts:
            return None
        try:
            if ts.endswith('Z'):
                ts = ts[:-1] + '+00:00'
            return datetime.fromisoformat(ts)
        except Exception:
            return None

    if search:
        s = search.strip().lower()
        items = [it for it in items if s in (it['delegateName'] or '').lower() or s in (it['organization'] or '').lower()]

    if status in ['success', 'failed', 'manual']:
        items = [it for it in items if it['status'] == status]

    from_dt = parse_iso(date_from)
    to_dt = parse_iso(date_to)
    if from_dt or to_dt:
        filtered: List[Dict[str, Any]] = []
        for it in items:
            ct = parse_iso(it['checkinTime'])
            if ct is None:
                continue
            ok = True
            if from_dt and ct < from_dt:
                ok = False
            if to_dt and ct > to_dt:
                ok = False
            if ok:
                filtered.append(it)
        items = filtered

    sort_key = 'checkinTime'
    if sort_by in ['checkinTime', 'confidence', 'delegateName']:
        sort_key = sort_by

    def sort_key_fn(it: Dict[str, Any]):
        if sort_key == 'checkinTime':
            ts = parse_iso(it['checkinTime'])
            return ts or datetime.min
        if sort_key == 'confidence':
            return it['confidence'] if it['confidence'] is not None else -1.0
        if sort_key == 'delegateName':
            return (it['delegateName'] or '').lower()
        return 0

    reverse = (sort_order.lower() == 'desc')
    items.sort(key=sort_key_fn, reverse=reverse)
    return items


@checkin_bp.route('/api/checkins/export', methods=['GET'])
def export_checkins():
    """Export checkins as CSV or XLSX. Returns fileUrl, fileName, expiresAt."""
    try:
        export_format = request.args.get('format', 'csv').lower()
        if export_format not in ['csv', 'xlsx']:
            return jsonify({'error': 'Invalid format. Use csv|xlsx'}), 400

        items = _filter_sort_items_for_export(request.args)

        # Prepare export directory
        from app.config import Config
        export_dir = Config.DB_DIR / 'exports'
        export_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
        file_base = f"checkins_{timestamp}"
        if export_format == 'csv':
            filename = f"{file_base}.csv"
            filepath = export_dir / filename
            # Write CSV
            with filepath.open('w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                # Header
                writer.writerow([
                    'id', 'delegateId', 'delegateName', 'organization', 'position',
                    'avatar', 'checkinTime', 'confidence', 'status', 'location', 'notes'
                ])
                for it in items:
                    writer.writerow([
                        it['id'], it['delegateId'], it['delegateName'], it['organization'], it['position'],
                        it['avatar'] or '', it['checkinTime'],
                        '' if it['confidence'] is None else it['confidence'],
                        it['status'], it['location'] or '', it['notes'] or ''
                    ])
        else:
            # XLSX support only if openpyxl is available
            try:
                import openpyxl  # type: ignore
                from openpyxl import Workbook  # type: ignore
            except Exception:
                return jsonify({'error': 'XLSX export requires openpyxl. Please install it or use CSV.'}), 400

            filename = f"{file_base}.xlsx"
            filepath = export_dir / filename
            wb = Workbook()
            ws = wb.active
            ws.title = 'Checkins'
            headers = ['id', 'delegateId', 'delegateName', 'organization', 'position', 'avatar', 'checkinTime', 'confidence', 'status', 'location', 'notes']
            ws.append(headers)
            for it in items:
                ws.append([
                    it['id'], it['delegateId'], it['delegateName'], it['organization'], it['position'],
                    it['avatar'] or '', it['checkinTime'],
                    '' if it['confidence'] is None else it['confidence'],
                    it['status'], it['location'] or '', it['notes'] or ''
                ])
            wb.save(str(filepath))

        # Provide simple file server URL
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat() + 'Z'
        file_url = f"/api/exports/{filename}"
        return jsonify({
            'fileUrl': file_url,
            'fileName': filename,
            'expiresAt': expires_at
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Error exporting checkins: {str(e)}'
            }
        }), 500


@checkin_bp.route('/api/exports/<path:filename>', methods=['GET'])
def download_export(filename: str):
    """Serve exported files from the exports directory."""
    try:
        from app.config import Config
        export_dir = Config.DB_DIR / 'exports'
        filepath = export_dir / filename
        if not filepath.exists() or not filepath.is_file():
            return jsonify({'error': 'File not found'}), 404
        return send_file(str(filepath), as_attachment=True)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'message': f'Error downloading export: {str(e)}'
            }
        }), 500
