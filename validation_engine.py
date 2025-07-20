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
            AND LOWER(TRIM(name)) = LOWER(TRIM(%s))
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
            WHERE LOWER(TRIM(brewery)) = LOWER(TRIM(%s))
        """, (beer_data['brewery'],))
        
        brewery_result = cursor.fetchone()
    if brewery_result:
        # Add debug logging to see what's happening
        self.logger.info(f"Found known brewery: '{brewery_result['brewery']}' for input: '{beer_data['brewery']}'")
        return {
            'status': 'new_beer_existing_brewery',
            'confidence': 0.7,
            'matched_brewery': brewery_result['brewery']
        }
    
    # Add debug logging for brewery not found
    self.logger.info(f"Brewery not found: '{beer_data['brewery']}'")
    
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

# ================================================================================
# 🔧 ACTION: ADD this to the bottom of your validation_engine.py file
# This is the "action taker" that does the actual work after validation
# ================================================================================

class SubmissionProcessor:
    """
    The action taker: After the validation engine decides what tier,
    this class actually does the work:
    - Stores the submission in database
    - Updates pub data (for Tier 1)
    - Queues items for review (for Tier 2 & 3)
    """
    
    def __init__(self, db_config):
        self.db_config = db_config
        self.validation_engine = BeerValidationEngine(db_config)
        self.logger = logging.getLogger(__name__)
    
    def process_submission(self, submission_data, user_info=None):
        """
        Main entry point: Takes user submission, validates it, then acts on it
        
        Args:
            submission_data: Dictionary with pub/beer info from user form
            user_info: Dictionary with user IP, user agent, etc.
            
        Returns:
            Dictionary with success/failure and submission details
        """
        try:
            # Step 1: Let the smart brain validate it
            validation_result = self.validation_engine.validate_submission(submission_data)
            
            # Step 2: Store the submission in our database (always)
            submission_id = self._store_submission(submission_data, validation_result, user_info)
            
            # Step 3: Take action based on what the brain decided
            if validation_result['action'] == 'update_database':
                # Tier 1: Update database immediately
                self._update_database_immediately(submission_data, validation_result)
                
            elif validation_result['action'] == 'queue_soft_validation':
                # Tier 2: Queue for auto-approval in 24 hours
                self._queue_soft_validation(submission_id, validation_result)
                
            elif validation_result['action'] == 'queue_manual_review':
                # Tier 3: Queue for human review
                self._queue_manual_review(submission_id, validation_result)
            
            # Step 4: Return result to user
            return {
                'success': True,
                'submission_id': submission_id,
                'validation_result': validation_result
            }
            
        except Exception as e:
            self.logger.error(f"Submission processing error: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to process submission',
                'details': str(e)
            }
    
    def _store_submission(self, submission_data, validation_result, user_info):
        """
        Store every submission in the submissions table for tracking
        Even if it's auto-approved, we keep a record
        """
        
        conn = mysql.connector.connect(**self.db_config)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO submissions 
                (pub_id, pub_name, address, postcode, brewery, beer_name, 
                 beer_style, beer_abv, beer_format, validation_tier, 
                 validation_status, user_ip, user_agent, submission_time)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                submission_data.get('pub_id'),
                submission_data.get('pub_name'),
                submission_data.get('address'),
                submission_data.get('postcode'),
                submission_data.get('brewery'),
                submission_data.get('beer_name'),
                submission_data.get('beer_style'),
                submission_data.get('beer_abv'),
                submission_data.get('beer_format'),
                validation_result['tier'],
                validation_result['status'],
                user_info.get('ip') if user_info else None,
                user_info.get('user_agent') if user_info else None
            ))
            
            submission_id = cursor.lastrowid
            conn.commit()
            return submission_id
            
        finally:
            cursor.close()
            conn.close()
    
    def _update_database_immediately(self, submission_data, validation_result):
        """
        For Tier 1 (auto-approved): Update the main database right now
        - Mark the pub as having this beer format
        - Add to pubs_updates table with specific beer details
        """
        
        conn = mysql.connector.connect(**self.db_config)
        cursor = conn.cursor()
        
        try:
            pub_id = validation_result['pub_data']['pub_id']
            beer_format = submission_data['beer_format']
            
            # Update the pub's beer format availability (bottle, tap, cask, can)
            # This uses the fixed CASE statement from our stored procedure
            if beer_format == 'bottle':
                cursor.execute("UPDATE pubs SET bottle = 1 WHERE pub_id = %s", (pub_id,))
            elif beer_format == 'tap':
                cursor.execute("UPDATE pubs SET tap = 1 WHERE pub_id = %s", (pub_id,))
            elif beer_format == 'cask':
                cursor.execute("UPDATE pubs SET cask = 1 WHERE pub_id = %s", (pub_id,))
            elif beer_format == 'can':
                cursor.execute("UPDATE pubs SET can = 1 WHERE pub_id = %s", (pub_id,))
            
            # If we know the specific beer, add to pubs_updates table
            if validation_result['beer_data']['status'] == 'existing':
                beer_id = validation_result['beer_data']['beer_id']
                
                cursor.execute("""
                    INSERT INTO pubs_updates (pub_id, beer_id, beer_format, update_time)
                    VALUES (%s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE 
                    update_time = NOW()
                """, (pub_id, beer_id, beer_format))
            
            conn.commit()
            self.logger.info(f"Auto-approved update applied to pub {pub_id}")
            
        finally:
            cursor.close()
            conn.close()
    
    def _queue_soft_validation(self, submission_id, validation_result):
        """
        For Tier 2: Queue for auto-approval after 24 hours
        Unless someone flags it in the meantime
        """
        
        conn = mysql.connector.connect(**self.db_config)
        cursor = conn.cursor()
        
        try:
            # Calculate when it should be auto-approved (24 hours from now)
            approval_time = datetime.now() + timedelta(hours=validation_result['delay_hours'])
            
            cursor.execute("""
                INSERT INTO validation_queue 
                (submission_id, validation_type, scheduled_approval_time, status)
                VALUES (%s, 'soft_validation', %s, 'pending')
            """, (submission_id, approval_time))
            
            conn.commit()
            self.logger.info(f"Submission {submission_id} queued for soft validation")
            
        finally:
            cursor.close()
            conn.close()
    
    def _queue_manual_review(self, submission_id, validation_result):
        """
        For Tier 3: Queue for human review
        Shows up in admin dashboard
        """
        
        conn = mysql.connector.connect(**self.db_config)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO validation_queue 
                (submission_id, validation_type, review_reasons, status)
                VALUES (%s, 'manual_review', %s, 'pending')
            """, (submission_id, ",".join(validation_result['reasons'])))
            
            conn.commit()
            self.logger.info(f"Submission {submission_id} queued for manual review")
            
            # TODO: Could send email notification to admin here
            # self._send_admin_notification(submission_id, validation_result)
            
        finally:
            cursor.close()
            conn.close()
