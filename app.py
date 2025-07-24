# ================================================================================
# COELIACS LIKE BEER TOO - CLEANED APP.PY
# 🧹 Streamlined version with only essential functionality
# ================================================================================

from flask import Flask, request, jsonify, render_template
import mysql.connector
import os
from dotenv import load_dotenv
import logging
import time
# ➕ ADD: Import your new smart classes
from validation_engine import BeerValidationEngine, SubmissionProcessor

# Initialize Flask app
app = Flask(__name__, 
            static_folder='static',
            static_url_path='/static')

# Load environment variables
load_dotenv()

# Database configuration
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
    "ssl_disabled": os.getenv("DB_SSL_DISABLED", "false").lower() == "true"
}

# Set up logging
logging.basicConfig(level=logging.INFO if os.getenv("FLASK_ENV") == "production" else logging.DEBUG)
logger = logging.getLogger(__name__)

# Security headers
@app.after_request
def security_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache" 
    response.headers["Expires"] = "0"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

from functools import wraps

# Simple admin authentication (we'll enhance this later)
def admin_required(f):
    """
    Decorator to protect admin endpoints
    For now uses a simple token, but we can upgrade to proper login later
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for admin token in header or URL parameter
        auth_token = request.headers.get('Authorization') or request.args.get('token')
        expected_token = os.getenv('ADMIN_TOKEN', 'beer_admin_2025')  # Change this!
        
        if not auth_token or auth_token != expected_token:
            return jsonify({'error': 'Admin authentication required'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

# ================================================================================
# CORE ROUTES
# ================================================================================

@app.route('/')
def index():
    """Homepage"""
    version = str(int(time.time()))
    return render_template('index.html', cache_buster=version)

@app.route('/autocomplete')
def autocomplete():
    """Autocomplete suggestions for search"""
    query = request.args.get('q', '').strip()
    search_type = request.args.get('search_type', 'all')
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    
    # Input validation
    if not query or len(query) < 2 or len(query) > 100:
        return jsonify([])

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Build search condition based on search type
        if search_type == 'name':
            search_condition = "name LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'postcode':
            search_condition = "postcode LIKE %s"
            params = (f'%{query}%',)
        elif search_type == 'area':
            search_condition = "local_authority LIKE %s"
            params = (f'%{query}%',)
        else:  # search_type == 'all'
            search_condition = "(name LIKE %s OR postcode LIKE %s OR local_authority LIKE %s OR address LIKE %s)"
            params = (f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%')
        
        sql = f"""
            SELECT pub_id, name, address, postcode
            FROM pubs
            WHERE {search_condition}
        """
        
        if gf_only:
            sql += " AND (bottle = 1 OR tap = 1 OR cask = 1 OR can = 1)"
        
        sql += " ORDER BY name LIMIT 100"
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        
        return jsonify(pubs)
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in autocomplete: {str(e)}")
        return jsonify([])
    except Exception as e:
        logger.error(f"Unexpected error in autocomplete: {str(e)}")
        return jsonify([])
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# REPLACE: In app.py, update the nearby search route
# Find the @app.route('/nearby') function and replace the gf_only logic

@app.route('/nearby')
def nearby():
    """Find nearby pubs"""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', 5, type=int)
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    
    # Input validation
    if not lat or not lng:
        return jsonify({'error': 'Latitude and longitude required'}), 400
    
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return jsonify({'error': 'Invalid coordinates'}), 400
    
    if not (1 <= radius <= 50):
        return jsonify({'error': 'Invalid radius'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        sql = """
            SELECT DISTINCT
                p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude,
                (6371 * acos(cos(radians(%s)) * cos(radians(p.latitude)) * 
                cos(radians(p.longitude) - radians(%s)) + sin(radians(%s)) * 
                sin(radians(p.latitude)))) AS distance,
                GROUP_CONCAT(
                    DISTINCT CONCAT(pu.beer_format, ' - ', 
                    COALESCE(b.brewery, 'Unknown'), ' ', 
                    COALESCE(b.name, 'Unknown'), ' (', 
                    COALESCE(b.style, 'Unknown'), ')')
                    SEPARATOR ', '
                ) as beer_details
            FROM pubs p
            LEFT JOIN pubs_updates pu ON p.pub_id = pu.pub_id
            LEFT JOIN beers b ON pu.beer_id = b.beer_id
            WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        """
        params = [lat, lng, lat]
        
        # CHANGE: Only apply GF filter if specifically requested (don't default to true)
        if gf_only:
            sql += " AND (p.bottle = 1 OR p.tap = 1 OR p.cask = 1 OR p.can = 1)"
        
        sql += """
            GROUP BY p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                     p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude
            HAVING distance <= %s
            ORDER BY distance
            LIMIT 50
        """
        params.append(radius)
        
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        
        return jsonify(pubs)
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in nearby search: {str(e)}")
        return jsonify({'error': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Unexpected error in nearby search: {str(e)}")
        return jsonify({'error': 'An error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# REPLACE: In app.py, update the main search route
# Find the @app.route('/search') function and update the gf_only handling

@app.route('/search')
def search():
    """Main search functionality"""
    query = request.args.get('query', '').strip()
    search_type = request.args.get('search_type', 'all')
    gf_only = request.args.get('gf_only', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    pub_id = request.args.get('pub_id', type=int)
    
    # Input validation
    if query and (len(query) < 1 or len(query) > 100):
        return jsonify({'error': 'Invalid query length'}), 400
    
    if page < 1 or page > 1000:
        return jsonify({'error': 'Invalid page number'}), 400

    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Handle specific pub ID search
        if pub_id:
            sql = """
                SELECT DISTINCT
                    p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                    p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude,
                    GROUP_CONCAT(
                        DISTINCT CONCAT(pu.beer_format, ' - ', 
                        COALESCE(b.brewery, 'Unknown'), ' ', 
                        COALESCE(b.name, 'Unknown'), ' (', 
                        COALESCE(b.style, 'Unknown'), ')')
                        SEPARATOR ', '
                    ) as beer_details
                FROM pubs p
                LEFT JOIN pubs_updates pu ON p.pub_id = pu.pub_id
                LEFT JOIN beers b ON pu.beer_id = b.beer_id
                WHERE p.pub_id = %s
                GROUP BY p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                         p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude
            """
            cursor.execute(sql, (pub_id,))
            pubs = cursor.fetchall()
            return jsonify(pubs)
        
        # Regular search logic
        if not query:
            return jsonify({'error': 'Query is required for search'}), 400
        
        # Build search condition based on search type
        if search_type == 'name':
            search_condition = "p.name LIKE %s"
            params = [f'%{query}%']
        elif search_type == 'postcode':
            search_condition = "p.postcode LIKE %s"
            params = [f'%{query}%']
        elif search_type == 'area':
            search_condition = "p.local_authority LIKE %s"
            params = [f'%{query}%']
        else:  # search_type == 'all'
            search_condition = "(p.name LIKE %s OR p.postcode LIKE %s OR p.local_authority LIKE %s OR p.address LIKE %s)"
            params = [f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%']
        
        # Count total results for pagination
        count_sql = f"""
            SELECT COUNT(DISTINCT p.pub_id) as total
            FROM pubs p
            WHERE {search_condition}
        """
        
        # CHANGE: Only apply GF filter if specifically requested
        if gf_only:
            count_sql += " AND (p.bottle = 1 OR p.tap = 1 OR p.cask = 1 OR p.can = 1)"
        
        cursor.execute(count_sql, params)
        total_results = cursor.fetchone()['total']
        
        # Calculate pagination
        per_page = 20
        total_pages = (total_results + per_page - 1) // per_page
        offset = (page - 1) * per_page
        
        # Main search query with beer details
        sql = f"""
            SELECT DISTINCT
                p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude,
                GROUP_CONCAT(
                    DISTINCT CONCAT(pu.beer_format, ' - ', 
                    COALESCE(b.brewery, 'Unknown'), ' ', 
                    COALESCE(b.name, 'Unknown'), ' (', 
                    COALESCE(b.style, 'Unknown'), ')')
                    SEPARATOR ', '
                ) as beer_details
            FROM pubs p
            LEFT JOIN pubs_updates pu ON p.pub_id = pu.pub_id
            LEFT JOIN beers b ON pu.beer_id = b.beer_id
            WHERE {search_condition}
        """
        
        # CHANGE: Only apply GF filter if specifically requested
        if gf_only:
            sql += " AND (p.bottle = 1 OR p.tap = 1 OR p.cask = 1 OR p.can = 1)"
        
        sql += """
            GROUP BY p.pub_id, p.name, p.address, p.postcode, p.local_authority, 
                     p.bottle, p.tap, p.cask, p.can, p.latitude, p.longitude
            ORDER BY p.name
            LIMIT %s OFFSET %s
        """
        
        params.extend([per_page, offset])
        cursor.execute(sql, params)
        pubs = cursor.fetchall()
        
        # Return paginated results
        return jsonify({
            'pubs': pubs,
            'pagination': {
                'page': page,
                'pages': total_pages,
                'total': total_results,
                'has_prev': page > 1,
                'has_next': page < total_pages
            }
        })
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in search: {str(e)}")
        return jsonify({'error': 'Database error occurred'}), 500
    except Exception as e:
        logger.error(f"Unexpected error in search: {str(e)}")
        return jsonify({'error': 'An error occurred'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ================================================================================
# API ROUTES
# ================================================================================

@app.route('/api/stats')
def get_stats():
    """Get site statistics"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Get total pubs
        cursor.execute("SELECT COUNT(*) as total FROM pubs")
        total_pubs = cursor.fetchone()[0]
        
        # Get distinct pubs with GF options
        cursor.execute("""
            SELECT COUNT(DISTINCT pub_id) as gf_total 
            FROM pubs 
            WHERE bottle=1 OR tap=1 OR cask=1 OR can=1
        """)
        gf_pubs = cursor.fetchone()[0]
        
        return jsonify({
            'total_pubs': total_pubs,
            'gf_pubs': gf_pubs
        })
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in stats: {str(e)}")
        return jsonify({
            'total_pubs': 49841,
            'gf_pubs': 1249
        })
    except Exception as e:
        logger.error(f"Unexpected error in stats: {str(e)}")
        return jsonify({
            'total_pubs': 49841,
            'gf_pubs': 1249
        })
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/breweries', methods=['GET'])
def get_breweries():
    """Get breweries for autocomplete"""
    query = request.args.get('q', '').strip()
    
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        if query:
            cursor.execute("""
                SELECT DISTINCT brewery 
                FROM beers 
                WHERE brewery LIKE %s
                ORDER BY brewery
                LIMIT 20
            """, (f'%{query}%',))
        else:
            cursor.execute("""
                SELECT DISTINCT brewery 
                FROM beers 
                ORDER BY brewery
                LIMIT 50
            """)
        
        breweries = [row[0] for row in cursor.fetchall()]
        return jsonify(breweries)
        
    except Exception as e:
        logger.error(f"Error fetching breweries: {str(e)}")
        return jsonify([])
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/brewery/<brewery_name>/beers', methods=['GET'])
def get_brewery_beers(brewery_name):
    """Get beers for a specific brewery"""
    query = request.args.get('q', '').strip()
    
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        if query:
            cursor.execute("""
                SELECT beer_id, name, style, abv, gluten_status, vegan_status
                FROM beers 
                WHERE brewery = %s AND name LIKE %s
                ORDER BY name
                LIMIT 20
            """, (brewery_name, f'%{query}%'))
        else:
            cursor.execute("""
                SELECT beer_id, name, style, abv, gluten_status, vegan_status
                FROM beers 
                WHERE brewery = %s 
                ORDER BY name
                LIMIT 50
            """, (brewery_name,))
        
        beers = cursor.fetchall()
        return jsonify(beers)
        
    except Exception as e:
        logger.error(f"Error fetching beers for {brewery_name}: {str(e)}")
        return jsonify([])
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/submit_beer_update', methods=['POST'])
def submit_beer_update():
    """
    ENHANCED: Smart beer submission with 3-tier validation system
    - Tier 1: Auto-approve instantly (known pub + known beer)
    - Tier 2: Soft validation (known pub + new beer from known brewery)  
    - Tier 3: Manual review (new pub or new brewery)
    """
    try:
        data = request.get_json()
        
        # FIXED: Handle both old and new field naming conventions
        submission_data = {
            'pub_id': data.get('pub_id'),
            # Handle pub name from multiple possible fields
            'pub_name': data.get('pub_name') or data.get('new_pub_name'),
            'address': data.get('address') or data.get('new_address'),
            'postcode': data.get('postcode') or data.get('new_postcode'),
            # FIXED: Check for both field names (with and without "new_" prefix)
            'brewery': data.get('brewery') or data.get('new_brewery'),
            'beer_name': data.get('beer_name') or data.get('new_beer_name'),
            'beer_style': data.get('beer_style') or data.get('new_style'),
            'beer_abv': data.get('beer_abv') or data.get('new_abv'),
            'beer_format': data.get('beer_format')
        }
        
        # Debug logging to see what we're actually getting
        logger.info(f"Raw request data: {data}")
        logger.info(f"Processed submission data: {submission_data}")
        
        # Basic validation - ensure we have required fields
        required_fields = ['beer_format']
        for field in required_fields:
            if not submission_data.get(field):
                logger.error(f"Missing required field: {field}")
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Get user info for tracking
        user_info = {
            'ip': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', '')
        }
        
        # Process submission through the smart validation system
        processor = SubmissionProcessor(db_config)
        result = processor.process_submission(data, user_info)
        
        if result['success']:
            # Success! Return user-friendly response based on validation tier
            validation_result = result['validation_result']
            
            # Customize response message based on tier
            if validation_result['tier'] == 1:
                user_message = "🎉 Beer report approved instantly! Thanks for contributing."
            elif validation_result['tier'] == 2:
                user_message = f"📋 Beer report received! {validation_result['message']}"
            else:  # tier 3
                user_message = "📋 Beer report submitted for review. We'll verify the details and add it soon!"
            
            return jsonify({
                'success': True,
                'message': user_message,
                'submission_id': result['submission_id'],
                'tier': validation_result['tier'],
                'status': validation_result['status']
            })
        else:
            # Something went wrong in processing
            logger.error(f"Submission processing failed: {result['error']}")
            return jsonify({
                'success': False,
                'error': 'Failed to process beer report. Please try again.'
            }), 500
            
    except Exception as e:
        logger.error(f"Error in submit_beer_update: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error. Please try again.'
        }), 500

# ======================
# ADMIN DASHBOARD ROUTES  
# ======================

@app.route('/admin')
def admin_dashboard():
    """
    Admin dashboard page - simple token auth for now
    Access via: /admin?token=beer_admin_2025
    """
    token = request.args.get('token')
    expected_token = os.getenv('ADMIN_TOKEN', 'beer_admin_2025')
    
    if not token or token != expected_token:
        return "🔒 Access denied. Admin token required.", 403
    
    # Return the admin interface HTML (we'll create this next)
    return render_template('admin.html')

@app.route('/api/admin/validation-stats')
@admin_required
def get_validation_stats():
    """
    Get validation statistics for the admin dashboard
    Shows: pending reviews, today's submissions, auto-approvals, etc.
    """
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Count pending manual reviews
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM validation_queue vq
            JOIN submissions s ON vq.submission_id = s.submission_id
            WHERE vq.validation_type = 'manual_review' AND vq.status = 'pending'
        """)
        pending_manual = cursor.fetchone()['count']
        
        # Count pending soft validations
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM validation_queue vq
            WHERE vq.validation_type = 'soft_validation' AND vq.status = 'pending'
        """)
        pending_soft = cursor.fetchone()['count']
        
        # Count today's submissions
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM submissions 
            WHERE DATE(submission_time) = CURDATE()
        """)
        today_submissions = cursor.fetchone()['count']
        
        # Count today's auto-approved submissions
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM submissions 
            WHERE DATE(submission_time) = CURDATE() 
            AND validation_status = 'auto_approved'
        """)
        auto_approved_today = cursor.fetchone()['count']
        
        return jsonify({
            'pending_manual': pending_manual,
            'pending_soft': pending_soft,
            'today_submissions': today_submissions,
            'auto_approved_today': auto_approved_today
        })
        
    except Exception as e:
        logger.error(f"Error getting validation stats: {str(e)}")
        return jsonify({'error': 'Failed to load stats'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/admin/pending-manual-reviews')
@admin_required
def get_pending_manual_reviews():
    """
    Get list of submissions pending manual review
    Uses the database view we created in the setup script
    """
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Use the view we created for pending manual reviews
        cursor.execute("""
            SELECT * FROM pending_manual_reviews 
            ORDER BY submission_time ASC
            LIMIT 50
        """)
        
        reviews = cursor.fetchall()
        return jsonify(reviews)
        
    except Exception as e:
        logger.error(f"Error getting pending reviews: {str(e)}")
        return jsonify({'error': 'Failed to load pending reviews'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/admin/soft-validation-queue')
@admin_required
def get_soft_validation_queue():
    """
    Get list of items in soft validation queue (waiting for auto-approval)
    """
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Use the view we created for soft validation queue
        cursor.execute("""
            SELECT * FROM soft_validation_queue 
            ORDER BY scheduled_approval_time ASC
            LIMIT 50
        """)
        
        items = cursor.fetchall()
        return jsonify(items)
        
    except Exception as e:
        logger.error(f"Error getting soft validation queue: {str(e)}")
        return jsonify({'error': 'Failed to load soft validation queue'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

@app.route('/api/admin/recent-submissions')
@admin_required
def get_recent_submissions():
    """
    Get recent submissions (last 7 days) for admin overview
    Shows all tiers and their status
    """
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                s.submission_id,
                s.pub_name,
                s.address,
                s.postcode,
                s.brewery,
                s.beer_name,
                s.beer_format,
                s.validation_tier,
                s.validation_status,
                s.submission_time,
                s.processed_at,
                CASE WHEN s.pub_id IS NULL THEN 'New Pub' ELSE 'Existing Pub' END as pub_status,
                CASE 
                    WHEN EXISTS (SELECT 1 FROM beers WHERE LOWER(brewery) = LOWER(s.brewery)) 
                    THEN 'Known Brewery' 
                    ELSE 'New Brewery' 
                END as brewery_status
            FROM submissions s
            WHERE s.submission_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY s.submission_time DESC
            LIMIT 100
        """)
        
        submissions = cursor.fetchall()
        return jsonify(submissions)
        
    except Exception as e:
        logger.error(f"Error getting recent submissions: {str(e)}")
        return jsonify({'error': 'Failed to load recent submissions'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ==================
# APPROVE SUBMISSION
# ==================

@app.route('/api/admin/approve-submission', methods=['POST'])
@admin_required
def approve_submission():
    """
    Approve a pending submission - this actually updates your live database!
    Can handle both existing pubs and create new pubs as needed
    """
    try:
        data = request.get_json()
        submission_id = data.get('submission_id')
        admin_notes = data.get('admin_notes', '')
        
        if not submission_id:
            return jsonify({'error': 'submission_id required'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get the submission details
        cursor.execute("""
            SELECT * FROM submissions WHERE submission_id = %s
        """, (submission_id,))
        
        submission = cursor.fetchone()
        if not submission:
            return jsonify({'error': 'Submission not found'}), 404
        
        # Start transaction for data consistency
        cursor.execute("START TRANSACTION")
        
        # If it's a new pub, create it first
        pub_id = submission['pub_id']
        if not pub_id:
            logger.info(f"Creating new pub: {submission['pub_name']}")
            
            # Create new pub with the beer format availability
            cursor.execute("""
                INSERT INTO pubs (name, address, postcode, bottle, tap, cask, can)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                submission['pub_name'],
                submission['address'],
                submission['postcode'],
                1 if submission['beer_format'] == 'bottle' else 0,
                1 if submission['beer_format'] == 'tap' else 0,
                1 if submission['beer_format'] == 'cask' else 0,
                1 if submission['beer_format'] == 'can' else 0
            ))
            
            pub_id = cursor.lastrowid
            
            # Update submission with new pub_id
            cursor.execute("""
                UPDATE submissions SET pub_id = %s WHERE submission_id = %s
            """, (pub_id, submission_id))
        else:
            # Update existing pub's beer format availability
            beer_format = submission['beer_format']
            if beer_format == 'bottle':
                cursor.execute("UPDATE pubs SET bottle = 1 WHERE pub_id = %s", (pub_id,))
            elif beer_format == 'tap':
                cursor.execute("UPDATE pubs SET tap = 1 WHERE pub_id = %s", (pub_id,))
            elif beer_format == 'cask':
                cursor.execute("UPDATE pubs SET cask = 1 WHERE pub_id = %s", (pub_id,))
            elif beer_format == 'can':
                cursor.execute("UPDATE pubs SET can = 1 WHERE pub_id = %s", (pub_id,))
        
        # If it's a new brewery/beer, add to beers table
        if submission['brewery'] and submission['beer_name']:
            cursor.execute("""
                SELECT beer_id FROM beers 
                WHERE LOWER(brewery) = LOWER(%s) AND LOWER(name) = LOWER(%s)
            """, (submission['brewery'], submission['beer_name']))
            
            existing_beer = cursor.fetchone()
            if not existing_beer:
                logger.info(f"Creating new beer: {submission['brewery']} - {submission['beer_name']}")
                
                cursor.execute("""
                    INSERT INTO beers (brewery, name, style, abv, gluten_status)
                    VALUES (%s, %s, %s, %s, 'gluten_removed')
                """, (
                    submission['brewery'],
                    submission['beer_name'],
                    submission['beer_style'],
                    submission['beer_abv']
                ))
                
                beer_id = cursor.lastrowid
            else:
                beer_id = existing_beer['beer_id']
            
            # Add to pubs_updates table to track specific beer at specific pub
            cursor.execute("""
                INSERT INTO pubs_updates (pub_id, beer_id, beer_format, update_time)
                VALUES (%s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE update_time = NOW()
            """, (pub_id, beer_id, submission['beer_format']))
        
        # Update submission status to approved
        cursor.execute("""
            UPDATE submissions 
            SET validation_status = 'approved',
                processed_at = NOW(),
                processed_by = 'admin',
                admin_notes = %s
            WHERE submission_id = %s
        """, (admin_notes, submission_id))
        
        # Update validation queue
        cursor.execute("""
            UPDATE validation_queue 
            SET status = 'approved',
                reviewed_at = NOW(),
                reviewed_by = 'admin',
                admin_notes = %s
            WHERE submission_id = %s
        """, (admin_notes, submission_id))
        
        # Commit all changes
        cursor.execute("COMMIT")
        
        logger.info(f"Submission {submission_id} approved by admin - pub_id: {pub_id}")
        
        return jsonify({
            'success': True, 
            'message': 'Submission approved successfully!',
            'pub_id': pub_id
        })
        
    except Exception as e:
        # Rollback on any error
        if 'cursor' in locals():
            cursor.execute("ROLLBACK")
        logger.error(f"Error approving submission: {str(e)}")
        return jsonify({'error': 'Failed to approve submission'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# =================
# REJECT SUBMISSION
# =================

@app.route('/api/admin/reject-submission', methods=['POST'])
@admin_required  
def reject_submission():
    """
    Reject a pending submission
    Marks it as rejected but keeps the record for audit purposes
    """
    try:
        data = request.get_json()
        submission_id = data.get('submission_id')
        admin_notes = data.get('admin_notes', '')
        
        if not submission_id:
            return jsonify({'error': 'submission_id required'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Update submission status to rejected
        cursor.execute("""
            UPDATE submissions 
            SET validation_status = 'rejected',
                processed_at = NOW(),
                processed_by = 'admin',
                admin_notes = %s
            WHERE submission_id = %s
        """, (admin_notes, submission_id))
        
        # Update validation queue
        cursor.execute("""
            UPDATE validation_queue 
            SET status = 'rejected',
                reviewed_at = NOW(),
                reviewed_by = 'admin',
                admin_notes = %s
            WHERE submission_id = %s
        """, (admin_notes, submission_id))
        
        conn.commit()
        
        logger.info(f"Submission {submission_id} rejected by admin")
        
        return jsonify({
            'success': True, 
            'message': 'Submission rejected'
        })
        
    except Exception as e:
        logger.error(f"Error rejecting submission: {str(e)}")
        return jsonify({'error': 'Failed to reject submission'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# =======================
# APPROVE SOFT VALIDATION
# =======================

@app.route('/api/admin/approve-soft-validation', methods=['POST'])
@admin_required
def approve_soft_validation_early():
    """
    Approve a soft validation item early (before the 24-hour timer)
    Useful if an admin wants to fast-track something
    """
    try:
        data = request.get_json()
        submission_id = data.get('submission_id')
        
        if not submission_id:
            return jsonify({'error': 'submission_id required'}), 400
        
        # Use the submission processor to handle the approval
        processor = SubmissionProcessor(db_config)
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get submission data
        cursor.execute("SELECT * FROM submissions WHERE submission_id = %s", (submission_id,))
        submission = cursor.fetchone()
        
        if not submission:
            return jsonify({'error': 'Submission not found'}), 404
        
        # Convert to the format expected by the processor
        submission_data = {
            'pub_id': submission['pub_id'],
            'beer_format': submission['beer_format']
        }
        
        # Get validation result (should be tier 2)
        validation_result = {
            'pub_data': {'pub_id': submission['pub_id']},
            'beer_data': {'status': 'new_beer_existing_brewery'}
        }
        
        # Apply the update immediately
        processor._update_database_immediately(submission_data, validation_result)
        
        # Update status
        cursor.execute("""
            UPDATE submissions 
            SET validation_status = 'approved',
                processed_at = NOW(),
                processed_by = 'admin_early'
            WHERE submission_id = %s
        """, (submission_id,))
        
        cursor.execute("""
            UPDATE validation_queue 
            SET status = 'approved',
                reviewed_at = NOW(),
                reviewed_by = 'admin_early'
            WHERE submission_id = %s
        """, (submission_id,))
        
        conn.commit()
        
        logger.info(f"Soft validation {submission_id} approved early by admin")
        
        return jsonify({
            'success': True, 
            'message': 'Soft validation approved early'
        })
        
    except Exception as e:
        logger.error(f"Error approving soft validation: {str(e)}")
        return jsonify({'error': 'Failed to approve soft validation'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ====================
# HEALTH & MONITORING
# ====================

@app.route('/health')
def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        
        return jsonify({
            'status': 'healthy',
            'timestamp': time.time(),
            'database': 'connected'
        })
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'timestamp': time.time(),
            'database': 'disconnected',
            'error': str(e)
        }), 503

# ============
# GET ALL PUBS
# ============

@app.route('/api/all-pubs')
def get_all_pubs_for_map():
    """Get all pubs with coordinates for map display"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get all pubs that have coordinates
        # Limit to reasonable number for performance
        cursor.execute("""
            SELECT 
                pub_id, name, address, postcode, local_authority,
                bottle, tap, cask, can, latitude, longitude,
                gf_status
            FROM pubs
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            LIMIT 10000
        """)
        
        pubs = cursor.fetchall()
        
        return jsonify({
            'success': True,
            'pubs': pubs,
            'total': len(pubs)
        })
        
    except Exception as e:
        logger.error(f"Error fetching all pubs: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to load pubs'
        }), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ============
# STATIC PAGES
# ============

@app.route('/privacy')
def privacy_policy():
    version = str(int(time.time()))
    return render_template('privacy.html', cache_buster=version)

@app.route('/terms')
def terms_of_service():
    version = str(int(time.time()))
    return render_template('terms.html', cache_buster=version)

@app.route('/cookies')
def cookie_policy():
    version = str(int(time.time()))
    return render_template('cookies.html', cache_buster=version)

@app.route('/accessibility')
def accessibility_statement():
    version = str(int(time.time()))
    return render_template('accessibility.html', cache_buster=version)

@app.route('/liability')
def liability_notice():
    version = str(int(time.time()))
    return render_template('liability.html', cache_buster=version)

@app.route('/breweries')
def gf_breweries():
    version = str(int(time.time()))
    return render_template('breweries.html', cache_buster=version)

# ================================================================================
# ERROR HANDLERS
# ================================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

# ================================================================================
# MAIN
# ================================================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting app on port {port}, debug mode: {debug}")
    app.run(debug=debug, host='0.0.0.0', port=port)
