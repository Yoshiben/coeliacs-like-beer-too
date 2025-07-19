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

# Initialize Flask app
app = Flask(__name__)

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
    """Submit beer update for validation"""
    try:
        data = request.get_json()
        
        # Basic validation
        required_fields = ['pub_id', 'beer_format']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Store the submission for validation
        cursor.execute("""
            INSERT INTO pending_beer_updates 
            (pub_id, beer_format, new_brewery, new_beer_name, new_style, 
             submitted_by_email, submitted_by_name, user_notes, photo_url, submission_time)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            data['pub_id'],
            data['beer_format'],
            data.get('brewery', ''),
            data.get('beer_name', ''),
            data.get('style', ''),
            data.get('email', ''),
            data.get('name', 'Anonymous'),
            data.get('notes', ''),
            data.get('photo_url', '')
        ))
        
        pending_id = cursor.lastrowid
        conn.commit()
        
        logger.info(f"Beer update submitted: pending_id {pending_id}")
        
        return jsonify({
            'message': 'Beer update submitted for validation',
            'pending_id': pending_id
        })
        
    except Exception as e:
        logger.error(f"Error submitting beer update: {str(e)}")
        return jsonify({'error': 'Submission failed'}), 500
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ================================================================================
# STATIC PAGES
# ================================================================================

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
# HEALTH & MONITORING
# ================================================================================

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
