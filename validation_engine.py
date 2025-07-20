# ================================================================================
# 🧠 VALIDATION_ENGINE.PY - The Smart Brain for Beer Submissions
# 🔧 ACTION: CREATE this as a new file in your project folder
# ================================================================================

import mysql.connector
from datetime import datetime, timedelta
import logging
from difflib import SequenceMatcher

class BeerValidationEngine:
    """
    The smart brain that decides if a beer submission should be:
    - Tier 1: Auto-approved instantly (known pub + known beer)
    - Tier 2: Soft validation with delay (known pub + new beer from known brewery)  
    - Tier 3: Manual review required (new pub or new brewery)
    """
    
    def __init__(self, db_config):
        self.db_config = db_config
        self.logger = logging.getLogger(__name__)
    
    def validate_submission(self, submission_data):
        """
        Main function: Takes submission data, returns validation decision
        
        Args:
            submission_data: Dictionary with pub/beer info from user form
            
        Returns:
            Dictionary with tier, status, message, and action to take
        """
        try:
            # Connect to database
            conn = mysql.connector.connect(**self.db_config)
            cursor = conn.cursor(dictionary=True)
            
            # Clean up the submission data
            pub_data = self._extract_pub_data(submission_data)
            beer_data = self._extract_beer_data(submission_data)
            
            # Check if we know this pub
            pub_status = self._validate_pub(cursor, pub_data)
            
            # Check if we know this beer
            beer_status = self._validate_beer(cursor, beer_data)
            
            # Decide which tier based on what we found
            validation_result = self._determine_validation_tier(pub_status, beer_status)
            
            return validation_result
            
        except Exception as e:
            self.logger.error(f"Validation error: {str(e)}")
            # If anything goes wrong, default to manual review
            return {
                'tier': 3,
                'status': 'error',
                'message': 'Validation error occurred - defaulting to manual review',
                'action': 'manual_review'
            }
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()
    
    def _extract_pub_data(self, submission):
        """
        Clean up pub data from user submission
        Removes extra spaces, standardizes format
        """
        return {
            'pub_id': submission.get('pub_id'),  # If they selected existing pub
            'name': submission.get('pub_name', '').strip(),
            'address': submission.get('address', '').strip(), 
            'postcode': submission.get('postcode', '').strip().upper()
        }
    
    def _extract_beer_data(self, submission):
        """
        Clean up beer data from user submission
        Removes extra spaces, standardizes format
        """
        return {
            'brewery': submission.get('brewery', '').strip(),
            'beer_name': submission.get('beer_name', '').strip(),
            'style': submission.get('beer_style', '').strip(),
            'abv': submission.get('beer_abv'),
            'format': submission.get('beer_format', '').strip().lower()
        }
    
    def _validate_pub(self, cursor, pub_data):
        """
        Check if we know this pub
        Returns: existing, similar, or new
        """
        
        # If they selected a pub from our dropdown, it's definitely existing
        if pub_data['pub_id']:
            cursor.execute("SELECT pub_id, name FROM pubs WHERE pub_id = %s", 
                         (pub_data['pub_id'],))
            result = cursor.fetchone()
            if result:
                return {
                    'status': 'existing',
                    'pub_id': result['pub_id'],
                    'confidence': 1.0,
                    'matched_name': result['name']
                }
        
        # Check for exact name + postcode match
        if pub_data['name'] and pub_data['postcode']:
            cursor.execute("""
                SELECT pub_id, name, address, postcode 
                FROM pubs 
                WHERE LOWER(name) = LOWER(%s) AND postcode = %s
            """, (pub_data['name'], pub_data['postcode']))
            
            result = cursor.fetchone()
            if result:
                return {
                    'status': 'existing',
                    'pub_id': result['pub_id'],
                    'confidence': 1.0,
                    'matched_name': result['name']
                }
        
        # Look for similar pub names (fuzzy matching)
        similar_matches = self._find_similar_pubs(cursor, pub_data)
        if similar_matches:
            return {
                'status': 'similar',
                'matches': similar_matches,
                'confidence': similar_matches[0]['confidence']
            }
        
        # No matches found - it's a new pub
        return {
            'status': 'new',
            'confidence': 0.0
        }
    
    def _validate_beer(self, cursor, beer_data):
        """
        Check if we know this beer
        Returns: existing, new_beer_existing_brewery, new_brewery, or incomplete
        """
        
        if not beer_data['brewery'] or not beer_data['beer_name']:
            return {'status': 'incomplete'}
        
        # Check for exact brewery + beer match
        cursor.execute("""
            SELECT beer_id, brewery, name, style, abv 
            FROM beers 
            WHERE LOWER(brewery) = LOWER(%s) AND LOWER(name) = LOWER(%s)
        """, (beer_data['brewery'], beer_data['beer_name']))
        
        result = cursor.fetchone()
        if result:
            return {
                'status': 'existing',
                'beer_id': result['beer_id'],
                'confidence': 1.0,
                'matched_data': result
            }
        
        # Check if we know this brewery (even if we don't know this specific beer)
        cursor.execute("""
            SELECT DISTINCT brewery 
            FROM beers 
            WHERE LOWER(brewery) = LOWER(%s)
        """, (beer_data['brewery'],))
        
        if cursor.fetchone():
            return {
                'status': 'new_beer_existing_brewery',
                'confidence': 0.7
            }
        
        # Completely new brewery
        return {
            'status': 'new_brewery',
            'confidence': 0.0
        }
    
    def _find_similar_pubs(self, cursor, pub_data):
        """
        Use fuzzy matching to find pubs with similar names
        Helps catch typos and slight variations
        """
        
        # Get pubs in same postcode area first (faster)
        postcode_area = pub_data['postcode'][:3] if pub_data['postcode'] else ''
        
        cursor.execute("""
            SELECT pub_id, name, address, postcode 
            FROM pubs 
            WHERE postcode LIKE %s
            LIMIT 20
        """, (f"{postcode_area}%",))
        
        candidates = cursor.fetchall()
        similar_matches = []
        
        for candidate in candidates:
            # Calculate how similar the names are (0.0 = completely different, 1.0 = identical)
            name_similarity = SequenceMatcher(None, 
                pub_data['name'].lower(), 
                candidate['name'].lower()
            ).ratio()
            
            # Calculate how similar the postcodes are
            postcode_similarity = SequenceMatcher(None,
                pub_data['postcode'],
                candidate['postcode']
            ).ratio()
            
            # Overall confidence (name matters more than postcode)
            confidence = (name_similarity * 0.7) + (postcode_similarity * 0.3)
            
            # Only include if reasonably similar (80%+ match)
            if confidence > 0.8:
                similar_matches.append({
                    'pub_id': candidate['pub_id'],
                    'name': candidate['name'],
                    'address': candidate['address'],
                    'postcode': candidate['postcode'],
                    'confidence': confidence,
                    'name_similarity': name_similarity,
                    'postcode_similarity': postcode_similarity
                })
        
        # Return best matches first
        similar_matches.sort(key=lambda x: x['confidence'], reverse=True)
        return similar_matches[:3]  # Top 3 matches only
    
    def _determine_validation_tier(self, pub_status, beer_status):
        """
        The decision engine: Based on what we know about pub and beer,
        decide which validation tier this submission should go to
        """
        
        # 🟢 TIER 1: Auto-approve instantly
        # We know both the pub and the beer - this is definitely legit
        if (pub_status['status'] == 'existing' and 
            beer_status['status'] == 'existing'):
            return {
                'tier': 1,
                'status': 'auto_approved',
                'message': 'Approved instantly - we know this pub and beer combination',
                'action': 'update_database',
                'pub_data': pub_status,
                'beer_data': beer_status
            }
        
        # 🟡 TIER 2: Soft validation (wait 24 hours then auto-approve)
        # We know the pub, and it's a new beer from a brewery we know
        # Probably legit, but let's wait a bit in case someone spots an issue
        if (pub_status['status'] == 'existing' and 
            beer_status['status'] == 'new_beer_existing_brewery'):
            return {
                'tier': 2,
                'status': 'soft_validation',
                'message': 'New beer from known brewery - will be approved in 24 hours unless flagged',
                'action': 'queue_soft_validation',
                'delay_hours': 24,
                'pub_data': pub_status,
                'beer_data': beer_status
            }
        
        # 🔴 TIER 3: Manual review required
        # Something's new or suspicious - human needs to check
        reasons = []
        if pub_status['status'] == 'new':
            reasons.append('new pub')
        elif pub_status['status'] == 'similar':
            reasons.append('similar pub found - possible duplicate')
            
        if beer_status['status'] == 'new_brewery':
            reasons.append('new brewery')
        elif beer_status['status'] == 'incomplete':
            reasons.append('incomplete beer information')
        
        return {
            'tier': 3,
            'status': 'manual_review_required',
            'message': f'Manual review needed: {", ".join(reasons)}',
            'action': 'queue_manual_review',
            'reasons': reasons,
            'pub_data': pub_status,
            'beer_data': beer_status
        }
