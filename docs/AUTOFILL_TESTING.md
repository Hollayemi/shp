# Autofill Database Testing Guide

## What Was Fixed

### 1. Number Input Validation ✅
- Changed input type from `number` to `text` with `inputMode="numeric"`
- Added `onKeyDown` handler to prevent letter keys
- Only allows digits 1-1000
- Prevents paste of non-numeric content

### 2. AI Column Name Matching ✅
- Now fetches actual table schema using `PRAGMA table_info()`
- Passes exact column names and types to AI
- AI generates records with correct column names
- Fails fast if column mismatch occurs

### 3. Loading State & Data Refresh ✅
- Added intermediate toast for insertion step
- Uses `Promise.all()` to wait for query invalidation
- Forces refetch after invalidation to ensure UI updates
- Shows actual inserted count in success message

### 4. Better Error Handling ✅
- Quotes table and column names to handle special characters
- Fails fast on schema errors (first record)
- Provides detailed error messages
- Continues inserting other records if one fails

### 5. Button Design Fixed ✅
- Simplified to match working "Autofill with AI" implementation
- Removed unnecessary event propagation handling
- Button text changed to "Autofill" for database context
- Consistent styling with other autofill buttons

### 6. UNIQUE Constraint Fix ✅
- Fetches current max ID from table before generation
- AI starts IDs from maxId + 1 to avoid conflicts
- Prevents "UNIQUE constraint failed" errors
- Works correctly on subsequent generations

## How to Test

### Test 1: Number Input Validation
1. Open a project with a database
2. Click the autofill button (sparkles icon) on any table
3. Try typing letters in "How many records" field
4. **Expected**: Letters should not appear, only numbers
5. Try pasting text like "abc123"
6. **Expected**: Only "123" should appear

### Test 2: Schema-Aware Generation
1. Click autofill on the "entities" table
2. Enter: 5 records
3. Description: "sample blog posts"
4. Click "Generate Records"
5. **Expected**: 
   - AI should use actual column names from your schema
   - No "SQLite error: table entities has no column named title"
   - Records should insert successfully

### Test 3: Loading States
1. Generate 10 records with description "tech companies"
2. **Expected**:
   - Toast shows "Generating 10 records..."
   - Then "Inserting 10 records into database..."
   - Then "Successfully generated and saved 10 records!"
   - Table expands and shows new data
   - Row count updates from "0 Records" to "10 Records"

### Test 4: Data Appears After Generation
1. Start with empty table (0 records)
2. Generate 5 records
3. **Expected**:
   - Loading gradient bar appears
   - After completion, table shows 5 rows of data
   - Row count shows "5 Records"
   - Data is visible in the table

### Test 5: Large Record Count
1. Try generating 100 records
2. Description: "US states and capitals"
3. **Expected**:
   - Credit estimate updates dynamically
   - Generation completes successfully
   - All 100 records inserted
   - Pagination appears if > 20 records

### Test 6: Complex Data Requirements
1. Generate 20 records
2. Description: "Fortune 500 companies with CEO names, founding year, and headquarters location"
3. **Expected**:
   - Credit estimate shows higher cost (complex data)
   - AI generates realistic company data
   - All fields populated correctly

## Common Issues & Solutions

### Issue: "table entities has no column named X"
**Solution**: Fixed! AI now fetches actual schema first.

### Issue: Row count shows 0 after generation
**Solution**: Fixed! Now forces refetch after invalidation.

### Issue: Letters can be typed in number field
**Solution**: Fixed! Added `onKeyDown` validation.

### Issue: Loading bar shows but no data appears
**Solution**: Fixed! Added proper query refetch after invalidation.

### Issue: "UNIQUE constraint failed: entities.id"
**Solution**: Fixed! AI now fetches max ID and starts from maxId + 1.

### Issue: Button design doesn't match "Autofill with AI"
**Solution**: Fixed! Simplified implementation to match working version.

## Testing Checklist

- [ ] Number input only accepts digits
- [ ] Can't type letters in record count field
- [ ] AI uses correct column names from schema
- [ ] No SQLite column errors
- [ ] Loading toast shows all steps
- [ ] Data appears after generation
- [ ] Row count updates correctly
- [ ] Table expands to show new data
- [ ] Credit estimate updates dynamically
- [ ] Works with different table schemas
- [ ] Handles errors gracefully

## Quick Test Command

To quickly test, you can:
1. Navigate to any project
2. Go to Database tab
3. Click autofill on any table
4. Enter: 3 records, "test data"
5. Verify all 3 records appear immediately

## Notes

- The AI now sees your exact table schema
- Column names are quoted to handle special characters
- Errors fail fast on first record to save credits
- Table list and data both refresh after generation
