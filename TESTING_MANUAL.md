# 🧪 Bocksed - Comprehensive Testing Manual

**Version:** 1.0.0  
**Last Updated:** February 21, 2026  
**Test Coverage:** 60+ Test Cases

---

## 📋 Table of Contents

1. [Testing Overview](#testing-overview)
2. [Pre-Testing Setup](#pre-testing-setup)
3. [Authentication Tests](#authentication-tests)
4. [Dashboard Tests](#dashboard-tests)
5. [Barcode Scanner Tests](#barcode-scanner-tests)
6. [Inventory Management Tests](#inventory-management-tests)
7. [FEFO Tests](#fefo-tests)
8. [AI Predictions Tests](#ai-predictions-tests)
9. [Admin Features Tests](#admin-features-tests)
10. [Alerts System Tests](#alerts-system-tests)
11. [Multi-Tenancy Tests](#multi-tenancy-tests)
12. [Performance Tests](#performance-tests)
13. [Security Tests](#security-tests)
14. [Edge Cases & Error Handling](#edge-cases--error-handling)
15. [Test Results Template](#test-results-template)

---

## 1. Testing Overview

### Purpose

This manual provides comprehensive testing procedures for Bocksed to ensure:
- All features work as expected
- Data integrity is maintained
- Security measures are effective
- Performance meets requirements
- User experience is smooth

### Testing Environment

**Required**:
- Android device or emulator (Android 8.0+)
- Backend server running (production or staging)
- MongoDB database with test data
- Internet connection
- Test user accounts (admin and staff)

**Test Data Requirements**:
- At least 10 products with various categories
- Products with different expiry dates (past, near, far)
- Sales history for AI predictions
- Multiple user accounts
- Multiple stores (for multi-tenancy testing)

### Test Execution Guidelines

1. **Sequential Testing**: Follow test cases in order
2. **Document Results**: Record pass/fail for each test
3. **Screenshot Issues**: Capture screenshots of any failures
4. **Report Bugs**: Document steps to reproduce issues
5. **Retest Fixes**: Verify bug fixes after implementation

---

## 2. Pre-Testing Setup

### 2.1 Backend Verification

**Test ID**: PRE-001  
**Priority**: Critical

**Steps**:
1. Open browser and navigate to backend URL
2. Verify health check endpoint responds
3. Check MongoDB connection status
4. Verify Cloudinary configuration

**Expected Results**:
- Backend returns 200 OK
- MongoDB shows "connected"
- Cloudinary shows "configured"

**API Endpoints to Test**:
```
GET /                    # Should return API info
GET /api                 # Should return endpoints list
GET /api/health          # Should return { status: 'ok' }
GET /api/test-db         # Should show MongoDB connection
```

### 2.2 Test Data Preparation

**Test ID**: PRE-002  
**Priority**: Critical

**Required Test Data**:

1. **Admin Account**:
   - Login PIN: [Your admin PIN]
   - Security PIN: [Your security PIN]
   - Store: Temple Hill

2. **Staff Account**:
   - Login PIN: [Your staff PIN]
   - Store: Temple Hill

3. **Products** (minimum 10):
   - 3 products expiring within 7 days
   - 3 products expiring within 30 days
   - 4 products with distant expiry dates
   - Mix of perishable and non-perishable
   - Various categories

4. **Sales Data**:
   - At least 5 sales transactions per product
   - Sales spread across last 30 days

---

## 3. Authentication Tests

### 3.1 Admin Login

**Test ID**: AUTH-001  
**Priority**: Critical  
**User Role**: Admin

**Steps**:
1. Launch the app
2. Select "Admin" role
3. Enter correct admin PIN
4. Tap "Login"

**Expected Results**:
- Success toast appears: "Welcome Back! Logged in as [Admin Name]"
- App navigates to admin dashboard
- User session is created
- Token stored in AsyncStorage

**Test Variations**:
- Test with incorrect PIN (should show error)
- Test with empty PIN (should show validation error)
- Test with backend offline (should fallback to local auth)

---

### 3.2 Staff Login

**Test ID**: AUTH-002  
**Priority**: Critical  
**User Role**: Staff

**Steps**:
1. Launch the app
2. Select "Staff" role
3. Enter correct staff PIN
4. Tap "Login"

**Expected Results**:
- Success toast appears
- App navigates to staff dashboard (tabs)
- Limited permissions applied
- Cannot access admin features

---

### 3.3 Session Management

**Test ID**: AUTH-003  
**Priority**: High  
**User Role**: Any

**Steps**:
1. Login successfully
2. Use app normally for 5 minutes
3. Close app (don't logout)
4. Reopen app within 30 minutes

**Expected Results**:
- User remains logged in
- No re-authentication required
- Session timestamp updated

**Test Variation**:
1. Login successfully
2. Wait 31 minutes without activity
3. Reopen app

**Expected Results**:
- Session expired
- User redirected to login screen
- Must re-authenticate

---

### 3.4 Logout

**Test ID**: AUTH-004  
**Priority**: High  
**User Role**: Any

**Steps**:
1. Login successfully
2. Navigate to Settings
3. Tap "Logout"
4. Confirm logout

**Expected Results**:
- Success toast: "Logged Out - Session ended successfully"
- User redirected to login screen
- All auth data cleared from AsyncStorage
- Cannot access protected screens

---

## 4. Dashboard Tests

### 4.1 Dashboard Load

**Test ID**: DASH-001  
**Priority**: Critical  
**User Role**: Staff/Admin

**Steps**:
1. Login successfully
2. Observe dashboard loading

**Expected Results**:
- Dashboard loads within 2 seconds
- All metrics display correctly:
  - Total products count
  - Low stock count
  - Expiring soon count
  - Total value
- AI status indicator shows correct state
- Recently sold section populated (if sales exist)
- No loading errors

---

### 4.2 AI Insights Badge

**Test ID**: DASH-002  
**Priority**: High  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to dashboard
2. Locate AI Insights badge
3. Verify urgent items count
4. Tap on AI Insights badge

**Expected Results**:
- Badge shows correct count of urgent predictions
- Tapping badge navigates to AI predictions screen
- Only shows predictions with risk > 70 or stockout < 7 days
- Updates in real-time via WebSocket

---

### 4.3 Recently Sold Section

**Test ID**: DASH-003  
**Priority**: Medium  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to dashboard
2. Scroll to "Recently Sold" section
3. Verify products displayed
4. Tap on a product

**Expected Results**:
- Shows last 10 sold products
- Each product shows: name, quantity sold, date
- Tapping product navigates to product details
- Empty state shown if no sales

---

### 4.4 Theme Toggle

**Test ID**: DASH-004  
**Priority**: Low  
**User Role**: Any

**Steps**:
1. Navigate to dashboard
2. Tap theme toggle icon (sun/moon)
3. Observe theme change
4. Close and reopen app

**Expected Results**:
- Theme switches between light and dark
- All screens reflect theme change
- Theme preference persists after app restart
- No visual glitches during transition

---

## 5. Barcode Scanner Tests

### 5.1 Scan Existing Product

**Test ID**: SCAN-001  
**Priority**: Critical  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to Scanner tab
2. Grant camera permission if prompted
3. Point camera at product barcode
4. Wait for scan detection

**Expected Results**:
- Camera opens successfully
- Barcode detected within 1 second
- Product details displayed
- Options shown: View Details, Update Stock, Add Sale
- Beep sound plays on successful scan

---

### 5.2 Scan New Product

**Test ID**: SCAN-002  
**Priority**: High  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to Scanner tab
2. Scan barcode not in database
3. Observe response

**Expected Results**:
- Message: "Product not found"
- Option to "Add New Product" displayed
- Tapping option navigates to Add Product screen
- Barcode pre-filled in form

---

### 5.3 Manual Barcode Entry

**Test ID**: SCAN-003  
**Priority**: Medium  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to Scanner tab
2. Tap "Enter Manually" button
3. Type barcode number
4. Tap "Search"

**Expected Results**:
- Input field appears
- Can type barcode
- Search works same as scanning
- Finds product if exists

---

## 6. Inventory Management Tests

### 6.1 View Inventory List

**Test ID**: INV-001  
**Priority**: Critical  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to Inventory tab
2. Observe product list

**Expected Results**:
- All products displayed
- Each product shows: image, name, quantity, category
- Products sorted alphabetically by default
- Search bar visible at top
- Category filter available
- Loading state shown while fetching

---

### 6.2 Search Products

**Test ID**: INV-002  
**Priority**: High  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to Inventory tab
2. Tap search bar
3. Type product name (partial or full)
4. Observe results

**Expected Results**:
- Results filter in real-time
- Matches partial names
- Case-insensitive search
- Shows "No results" if no matches
- Clear button appears in search bar

---

### 6.3 Filter by Category

**Test ID**: INV-003  
**Priority**: High  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to Inventory tab
2. Tap category filter dropdown
3. Select a category
4. Observe filtered results

**Expected Results**:
- Only products in selected category shown
- Count updates to reflect filtered results
- "All Categories" option resets filter
- Filter persists during session

---

### 6.4 View Product Details

**Test ID**: INV-004  
**Priority**: Critical  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to Inventory tab
2. Tap on any product
3. Observe product details screen

**Expected Results**:
- Product image displayed (or placeholder)
- All details shown: name, barcode, category, quantity
- Batch information displayed with expiry dates
- AI prediction visible (if available)
- Action buttons: Edit, Delete, Add Sale
- Back button works

---

### 6.5 Edit Product

**Test ID**: INV-005  
**Priority**: High  
**User Role**: Admin only

**Steps**:
1. Navigate to product details
2. Tap "Edit" button
3. Modify product information
4. Tap "Save"

**Expected Results**:
- Edit form pre-filled with current data
- Can modify: name, category, price, quantity
- Cannot modify barcode
- Changes saved to database
- Success toast shown
- Product list updates immediately

---

### 6.6 Delete Product (Admin)

**Test ID**: INV-006  
**Priority**: Critical  
**User Role**: Admin only

**Steps**:
1. Navigate to product details
2. Tap "Delete" button
3. Enter Security PIN when prompted
4. Confirm deletion

**Expected Results**:
- Security PIN prompt appears
- Correct PIN allows deletion
- Incorrect PIN shows error
- Product removed from database
- Success toast shown
- Navigates back to inventory list
- Product no longer appears in list

---

### 6.7 Delete Product (Staff - Should Fail)

**Test ID**: INV-007  
**Priority**: High  
**User Role**: Staff

**Steps**:
1. Login as staff
2. Navigate to product details
3. Look for Delete button

**Expected Results**:
- Delete button not visible for staff users
- Staff cannot delete products
- Permission check enforced

---

## 7. FEFO Tests

### 7.1 FEFO List Display

**Test ID**: FEFO-001  
**Priority**: Critical  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to FEFO tab
2. Observe product list

**Expected Results**:
- Products sorted by expiry date (earliest first)
- Only perishable products shown
- Each product shows: name, expiry date, days until expiry
- Color coding:
  - Red: Expired or < 3 days
  - Orange: 3-7 days
  - Yellow: 7-14 days
  - Green: > 14 days
- Empty state if no perishable products

---

### 7.2 AI Risk Sorting

**Test ID**: FEFO-002  
**Priority**: High  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to FEFO tab
2. Toggle "Sort by AI Risk" switch
3. Observe new sorting

**Expected Results**:
- Products re-sorted by AI risk score (highest first)
- Risk scores displayed (0-100)
- Products with higher risk appear first
- Toggle persists during session

---

### 7.3 Discount Recommendations

**Test ID**: FEFO-003  
**Priority**: Medium  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to FEFO tab
2. Find product expiring within 7 days
3. Observe discount recommendation

**Expected Results**:
- Discount percentage shown based on days to expiry:
  - < 3 days: 40-50% off
  - 3-7 days: 20-30% off
  - 7-14 days: 10-15% off
- Recommendation is actionable
- Helps staff make pricing decisions

---

## 8. AI Predictions Tests

### 8.1 View Predictions List

**Test ID**: AI-001  
**Priority**: Critical  
**User Role**: Admin

**Steps**:
1. Login as admin
2. Navigate to Admin Dashboard
3. Tap "AI Predictions" or view AI Insights
4. Observe predictions list

**Expected Results**:
- All products with predictions shown
- Each prediction shows:
  - Product name
  - Risk score (0-100)
  - Days to stockout
  - Forecast (7, 14, 30 days)
  - Recommendations
- Sorted by risk score (highest first)
- Real-time updates via WebSocket

---

### 8.2 Prediction Accuracy

**Test ID**: AI-002  
**Priority**: High  
**User Role**: Admin

**Steps**:
1. View AI predictions
2. Note forecast for a product
3. Wait 7 days
4. Compare actual sales to forecast

**Expected Results**:
- Forecast within 20% of actual sales
- Confidence score reflects accuracy
- Predictions improve over time with more data

---

### 8.3 Risk Score Calculation

**Test ID**: AI-003  
**Priority**: High  
**User Role**: Admin

**Steps**:
1. View predictions for multiple products
2. Verify risk scores make sense
3. Check factors contributing to risk

**Expected Results**:
- High risk (70-100): Low stock + high demand
- Medium risk (40-69): Moderate stock or demand
- Low risk (0-39): Adequate stock + low demand
- Risk score updates every 5 minutes

---

## 9. Admin Features Tests

### 9.1 Admin Dashboard Access

**Test ID**: ADMIN-001  
**Priority**: Critical  
**User Role**: Admin

**Steps**:
1. Login as admin
2. Navigate to Admin Dashboard
3. Observe available features

**Expected Results**:
- Admin dashboard accessible
- Shows: Stats, Sales, Inventory, Settings
- All admin features visible
- Staff users cannot access

---

### 9.2 Analytics & Stats

**Test ID**: ADMIN-002  
**Priority**: High  
**User Role**: Admin

**Steps**:
1. Navigate to Admin > Stats
2. Observe analytics data

**Expected Results**:
- Sales charts displayed
- Revenue metrics shown
- Top selling products listed
- Category breakdown visible
- Date range filter works
- Export functionality available

---

### 9.3 Staff Management

**Test ID**: ADMIN-003  
**Priority**: High  
**User Role**: Admin

**Steps**:
1. Navigate to Admin > Settings > Profile
2. View staff list
3. Tap on a staff member

**Expected Results**:
- All staff members listed
- Each shows: name, role, status
- Can view staff details
- Can delete staff (with confirmation)
- "Tap to login as [name]" hint visible

---

### 9.4 Admin Impersonation

**Test ID**: ADMIN-004  
**Priority**: High  
**User Role**: Admin

**Steps**:
1. Navigate to Admin > Settings > Profile
2. Tap on a staff member's card
3. Observe navigation

**Expected Results**:
- Success toast: "Now logged in as [Staff Name]"
- Navigates to staff dashboard (tabs)
- Admin is now impersonating staff
- Staff permissions applied
- Can logout to return to admin account

---

### 9.5 Security PIN Management

**Test ID**: ADMIN-005  
**Priority**: Critical  
**User Role**: Admin

**Steps**:
1. Navigate to Admin > Settings > Security
2. Change Security PIN
3. Enter current PIN
4. Enter new PIN twice
5. Save changes

**Expected Results**:
- Current PIN validated
- New PIN must match confirmation
- PIN updated in database
- Success toast shown
- New PIN required for future sensitive operations

---

## 10. Alerts System Tests

### 10.1 View Alerts

**Test ID**: ALERT-001  
**Priority**: High  
**User Role**: Staff/Admin

**Steps**:
1. Navigate to Alerts page
2. Observe alerts list

**Expected Results**:
- All active alerts displayed
- Each alert shows:
  - Product name
  - Alert type (expiry, low stock, etc.)
  - Severity (critical, warning, info)
  - Days until expiry
- Sorted by severity
- Empty state if no alerts

---

### 10.2 Alert Thresholds

**Test ID**: ALERT-002  
**Priority**: High  
**User Role**: Admin

**Steps**:
1. Navigate to Admin > Settings > Alerts
2. View current thresholds
3. Modify threshold values
4. Save changes

**Expected Results**:
- Current thresholds displayed
- Can modify: expiry warning days, low stock threshold
- Changes saved to database
- Alerts recalculated based on new thresholds
- Success toast shown

---

### 10.3 Alert Notifications

**Test ID**: ALERT-003  
**Priority**: Medium  
**User Role**: Staff/Admin

**Steps**:
1. Add product expiring within alert threshold
2. Wait for alert generation
3. Check alerts page

**Expected Results**:
- New alert appears within 5 minutes
- Alert shows correct information
- Severity matches expiry urgency
- Real-time update via WebSocket

---

## 11. Multi-Tenancy Tests

### 11.1 Data Isolation

**Test ID**: TENANT-001  
**Priority**: Critical  
**User Role**: Admin

**Steps**:
1. Login to Store A
2. Add a product
3. Logout
4. Login to Store B
5. Check inventory

**Expected Results**:
- Product from Store A not visible in Store B
- Each store sees only their own data
- No data leakage between stores
- Store ID properly filtered in all queries

---

### 11.2 Staff Access Control

**Test ID**: TENANT-002  
**Priority**: Critical  
**User Role**: Staff

**Steps**:
1. Create staff account for Store A
2. Login as staff
3. Attempt to access Store B data

**Expected Results**:
- Staff can only access their assigned store
- Cannot view or modify other stores' data
- Store ID validation enforced
- Unauthorized access blocked

---

## 12. Performance Tests

### 12.1 App Launch Time

**Test ID**: PERF-001  
**Priority**: High

**Steps**:
1. Close app completely
2. Launch app
3. Measure time to dashboard

**Expected Results**:
- App launches within 2 seconds
- Splash screen displays briefly
- Dashboard loads smoothly
- No lag or freezing

---

### 12.2 API Response Time

**Test ID**: PERF-002  
**Priority**: High

**Steps**:
1. Monitor network requests
2. Measure API response times

**Expected Results**:
- GET requests: < 200ms average
- POST requests: < 300ms average
- Image uploads: < 3 seconds
- No timeouts under normal conditions

---

### 12.3 Large Inventory Performance

**Test ID**: PERF-003  
**Priority**: Medium

**Steps**:
1. Load inventory with 100+ products
2. Scroll through list
3. Search products
4. Filter by category

**Expected Results**:
- Smooth scrolling (60 FPS)
- Search results instant
- No lag when filtering
- Memory usage stable

---

## 13. Security Tests

### 13.1 JWT Token Validation

**Test ID**: SEC-001  
**Priority**: Critical

**Steps**:
1. Login successfully
2. Manually modify JWT token in AsyncStorage
3. Make API request

**Expected Results**:
- Invalid token rejected
- 401 Unauthorized response
- User logged out automatically
- Must re-authenticate

---

### 13.2 Security PIN Protection

**Test ID**: SEC-002  
**Priority**: Critical

**Steps**:
1. Attempt to delete product
2. Enter incorrect Security PIN
3. Observe result

**Expected Results**:
- Operation blocked
- Error message shown
- Product not deleted
- PIN attempts may be limited

---

### 13.3 Role-Based Access Control

**Test ID**: SEC-003  
**Priority**: Critical

**Steps**:
1. Login as staff
2. Attempt to access admin features
3. Observe result

**Expected Results**:
- Admin features not visible
- Direct navigation blocked
- Permission error if attempted
- Role validation enforced

---

## 14. Edge Cases & Error Handling

### 14.1 Network Offline

**Test ID**: EDGE-001  
**Priority**: High

**Steps**:
1. Disable internet connection
2. Use app features
3. Re-enable connection

**Expected Results**:
- App shows offline indicator
- Cached data still accessible
- Operations queued for sync
- Graceful error messages
- Auto-sync when connection restored

---

### 14.2 Backend Unavailable

**Test ID**: EDGE-002  
**Priority**: High

**Steps**:
1. Stop backend server
2. Attempt to login
3. Attempt to fetch data

**Expected Results**:
- Fallback to local authentication
- Cached data displayed
- Error messages user-friendly
- App remains functional
- Retry mechanism active

---

### 14.3 Invalid Data Input

**Test ID**: EDGE-003  
**Priority**: Medium

**Steps**:
1. Try to add product with empty name
2. Try to add product with negative quantity
3. Try to add product with invalid barcode

**Expected Results**:
- Validation errors shown
- Form submission blocked
- Clear error messages
- No database corruption

---

### 14.4 Concurrent Updates

**Test ID**: EDGE-004  
**Priority**: Medium

**Steps**:
1. Open app on two devices
2. Edit same product on both
3. Save changes

**Expected Results**:
- Last write wins (or conflict resolution)
- No data corruption
- Both devices sync eventually
- WebSocket updates both clients

---

## 15. Test Results Template

### Test Execution Log

| Test ID | Test Name | Date | Tester | Result | Notes |
|---------|-----------|------|--------|--------|-------|
| AUTH-001 | Admin Login | | | ☐ Pass ☐ Fail | |
| AUTH-002 | Staff Login | | | ☐ Pass ☐ Fail | |
| DASH-001 | Dashboard Load | | | ☐ Pass ☐ Fail | |
| SCAN-001 | Scan Existing Product | | | ☐ Pass ☐ Fail | |
| INV-001 | View Inventory List | | | ☐ Pass ☐ Fail | |
| FEFO-001 | FEFO List Display | | | ☐ Pass ☐ Fail | |
| AI-001 | View Predictions List | | | ☐ Pass ☐ Fail | |
| ADMIN-001 | Admin Dashboard Access | | | ☐ Pass ☐ Fail | |
| ALERT-001 | View Alerts | | | ☐ Pass ☐ Fail | |
| TENANT-001 | Data Isolation | | | ☐ Pass ☐ Fail | |
| PERF-001 | App Launch Time | | | ☐ Pass ☐ Fail | |
| SEC-001 | JWT Token Validation | | | ☐ Pass ☐ Fail | |
| EDGE-001 | Network Offline | | | ☐ Pass ☐ Fail | |

### Bug Report Template

```
Bug ID: BUG-XXX
Title: [Short description]
Severity: Critical / High / Medium / Low
Priority: P1 / P2 / P3 / P4

Steps to Reproduce:
1. 
2. 
3. 

Expected Result:
[What should happen]

Actual Result:
[What actually happened]

Environment:
- Device: 
- OS Version: 
- App Version: 
- Backend URL: 

Screenshots:
[Attach screenshots]

Additional Notes:
[Any other relevant information]
```

---

## Testing Checklist

### Pre-Release Testing

- [ ] All authentication tests passed
- [ ] All dashboard tests passed
- [ ] All scanner tests passed
- [ ] All inventory tests passed
- [ ] All FEFO tests passed
- [ ] All AI prediction tests passed
- [ ] All admin feature tests passed
- [ ] All alert system tests passed
- [ ] All multi-tenancy tests passed
- [ ] All performance tests passed
- [ ] All security tests passed
- [ ] All edge case tests passed
- [ ] No critical bugs remaining
- [ ] No high-priority bugs remaining
- [ ] Documentation updated
- [ ] Build tested on multiple devices

### Sign-Off

**Tested By**: ___________________  
**Date**: ___________________  
**Signature**: ___________________  

**Approved By**: ___________________  
**Date**: ___________________  
**Signature**: ___________________  

---

**End of Testing Manual**

*For questions or issues, contact the development team.*
