# Phase 6: User Preferences & Settings — Implementation Plan

**Phase**: 6  
**Status**: PLANNING  
**Date**: May 18, 2026  
**Estimated Duration**: 3-4 days  
**Estimated Code**: ~4,000-5,000 lines  
**Estimated Documentation**: ~2,000 lines

---

## Phase Overview

Phase 6 focuses on implementing comprehensive user preferences and settings management. This phase enables users to customize their experience, manage privacy settings, control notifications, and configure account preferences. The implementation builds on Phase 5's foundation to provide a complete user control system.

---

## Phase Goals

1. **User Settings Management**: Allow users to view and update their profile settings
2. **Privacy Controls**: Implement granular privacy settings for profile visibility and data sharing
3. **Notification Preferences**: Extend Phase 5 notifications with user-configurable preferences
4. **Account Security**: Add password management, two-factor authentication, and session management
5. **Data Management**: Implement data export, deletion, and backup functionality
6. **Preferences Persistence**: Store all preferences in Supabase for persistence across sessions

---

## Tasks Breakdown

### Task 25: Settings Dashboard & Profile Management
**Estimated Duration**: 8-10 hours  
**Estimated Code**: ~1,200 lines  
**Estimated Documentation**: ~400 lines

#### Deliverables
- Settings dashboard layout with navigation tabs
- Profile settings section (name, bio, photos, interests)
- Account settings section (email, phone, username)
- Preferences section (language, timezone, theme)
- Settings API endpoints (GET, PUT)
- Settings store for state management
- Form validation and error handling
- Success/error notifications

#### Components
1. **SettingsDashboard.svelte** - Main settings layout with tabs
2. **ProfileSettings.svelte** - Profile information editing
3. **AccountSettings.svelte** - Account details editing
4. **PreferencesSettings.svelte** - User preferences (language, timezone, theme)
5. **SettingsForm.svelte** - Reusable form component with validation

#### API Endpoints
1. **GET /api/verified-vibe/settings** - Fetch user settings
2. **PUT /api/verified-vibe/settings** - Update user settings
3. **GET /api/verified-vibe/settings/profile** - Fetch profile settings
4. **PUT /api/verified-vibe/settings/profile** - Update profile settings

#### Database Schema
```sql
-- User Settings Table
CREATE TABLE user_settings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  theme VARCHAR(20) DEFAULT 'light',
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  marketing_emails BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- User Profile Settings Table
CREATE TABLE user_profile_settings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  bio TEXT,
  interests TEXT[],
  looking_for TEXT,
  photos TEXT[],
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);
```

---

### Task 26: Privacy & Data Controls
**Estimated Duration**: 8-10 hours  
**Estimated Code**: ~1,200 lines  
**Estimated Documentation**: ~400 lines

#### Deliverables
- Privacy settings section (profile visibility, data sharing)
- Blocking and reporting functionality
- Data export feature (download user data as JSON/CSV)
- Account deletion with confirmation
- Privacy API endpoints (GET, PUT, DELETE)
- Privacy store for state management
- Confirmation dialogs for destructive actions
- Audit logging for sensitive operations

#### Components
1. **PrivacySettings.svelte** - Privacy controls
2. **BlockedUsers.svelte** - Manage blocked users
3. **DataExport.svelte** - Export user data
4. **AccountDeletion.svelte** - Delete account with confirmation
5. **ConfirmationDialog.svelte** - Reusable confirmation modal

#### API Endpoints
1. **GET /api/verified-vibe/privacy** - Fetch privacy settings
2. **PUT /api/verified-vibe/privacy** - Update privacy settings
3. **GET /api/verified-vibe/blocked-users** - Fetch blocked users list
4. **POST /api/verified-vibe/blocked-users** - Block a user
5. **DELETE /api/verified-vibe/blocked-users** - Unblock a user
6. **POST /api/verified-vibe/export-data** - Export user data
7. **DELETE /api/verified-vibe/account** - Delete account

#### Database Schema
```sql
-- Privacy Settings Table
CREATE TABLE privacy_settings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  profile_visibility VARCHAR(20) DEFAULT 'public', -- public, private, friends_only
  show_online_status BOOLEAN DEFAULT true,
  show_last_seen BOOLEAN DEFAULT true,
  allow_messages_from VARCHAR(20) DEFAULT 'anyone', -- anyone, matches_only, friends_only
  data_sharing BOOLEAN DEFAULT false,
  analytics_tracking BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Blocked Users Table
CREATE TABLE blocked_users (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, blocked_user_id)
);

-- Audit Log Table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Task 27: Security & Account Management
**Estimated Duration**: 8-10 hours  
**Estimated Code**: ~1,200 lines  
**Estimated Documentation**: ~400 lines

#### Deliverables
- Password change functionality with validation
- Two-factor authentication (2FA) setup and management
- Session management (view active sessions, logout from other devices)
- Login history and security alerts
- Security API endpoints (POST, PUT, DELETE)
- Security store for state management
- Password strength indicator
- 2FA setup wizard with QR code

#### Components
1. **SecuritySettings.svelte** - Security controls
2. **PasswordChange.svelte** - Change password form
3. **TwoFactorAuth.svelte** - 2FA setup and management
4. **SessionManagement.svelte** - View and manage active sessions
5. **LoginHistory.svelte** - View login history
6. **PasswordStrengthIndicator.svelte** - Password strength display

#### API Endpoints
1. **POST /api/verified-vibe/change-password** - Change password
2. **POST /api/verified-vibe/2fa/setup** - Setup 2FA
3. **POST /api/verified-vibe/2fa/verify** - Verify 2FA code
4. **DELETE /api/verified-vibe/2fa** - Disable 2FA
5. **GET /api/verified-vibe/sessions** - Fetch active sessions
6. **DELETE /api/verified-vibe/sessions/:sessionId** - Logout from session
7. **GET /api/verified-vibe/login-history** - Fetch login history

#### Database Schema
```sql
-- User Security Table
CREATE TABLE user_security (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  password_changed_at TIMESTAMP,
  last_login_at TIMESTAMP,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Session Table
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  device_name VARCHAR(255),
  device_type VARCHAR(50), -- mobile, desktop, tablet
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Login History Table
CREATE TABLE login_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  device_type VARCHAR(50),
  success BOOLEAN DEFAULT true,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Task 28: Notification Preferences & Alerts
**Estimated Duration**: 6-8 hours  
**Estimated Code**: ~800 lines  
**Estimated Documentation**: ~300 lines

#### Deliverables
- Extend Phase 5 notification preferences with more options
- Email notification templates and scheduling
- Push notification settings per device
- SMS notification settings
- Notification frequency controls (immediate, daily digest, weekly digest)
- Notification categories (messages, matches, system, marketing)
- Notification API endpoints (GET, PUT)
- Notification preferences store

#### Components
1. **NotificationPreferences.svelte** - Main notification settings
2. **EmailNotifications.svelte** - Email notification settings
3. **PushNotifications.svelte** - Push notification settings
4. **SMSNotifications.svelte** - SMS notification settings
5. **NotificationFrequency.svelte** - Frequency controls

#### API Endpoints
1. **GET /api/verified-vibe/notification-preferences** - Fetch preferences
2. **PUT /api/verified-vibe/notification-preferences** - Update preferences
3. **GET /api/verified-vibe/notification-templates** - Fetch email templates
4. **POST /api/verified-vibe/notification-test** - Send test notification

#### Database Schema
```sql
-- Extended Notification Preferences Table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- Message notifications
  message_notifications BOOLEAN DEFAULT true,
  message_frequency VARCHAR(20) DEFAULT 'immediate', -- immediate, daily, weekly
  message_email BOOLEAN DEFAULT true,
  message_push BOOLEAN DEFAULT true,
  message_sms BOOLEAN DEFAULT false,
  -- Match notifications
  match_notifications BOOLEAN DEFAULT true,
  match_frequency VARCHAR(20) DEFAULT 'immediate',
  match_email BOOLEAN DEFAULT true,
  match_push BOOLEAN DEFAULT true,
  match_sms BOOLEAN DEFAULT false,
  -- System notifications
  system_notifications BOOLEAN DEFAULT true,
  system_frequency VARCHAR(20) DEFAULT 'immediate',
  system_email BOOLEAN DEFAULT false,
  system_push BOOLEAN DEFAULT true,
  system_sms BOOLEAN DEFAULT false,
  -- Marketing notifications
  marketing_notifications BOOLEAN DEFAULT false,
  marketing_frequency VARCHAR(20) DEFAULT 'weekly',
  marketing_email BOOLEAN DEFAULT false,
  marketing_push BOOLEAN DEFAULT false,
  -- Do Not Disturb
  dnd_enabled BOOLEAN DEFAULT false,
  dnd_start_time TIME,
  dnd_end_time TIME,
  dnd_days TEXT[], -- ['MON', 'TUE', ...]
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Notification Delivery Log Table
CREATE TABLE notification_delivery_log (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  notification_type VARCHAR(50),
  delivery_method VARCHAR(20), -- email, push, sms, in_app
  status VARCHAR(20), -- sent, failed, bounced
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Task 29: Settings UI & Integration
**Estimated Duration**: 6-8 hours  
**Estimated Code**: ~800 lines  
**Estimated Documentation**: ~300 lines

#### Deliverables
- Settings page layout with sidebar navigation
- Settings page routing and navigation
- Integration of all settings components
- Settings state management with Svelte stores
- Settings sync across tabs/windows
- Settings backup and restore
- Settings import/export
- Settings UI polish and animations

#### Components
1. **SettingsPage.svelte** - Main settings page layout
2. **SettingsSidebar.svelte** - Settings navigation sidebar
3. **SettingsHeader.svelte** - Settings page header
4. **SettingsTabs.svelte** - Tab navigation for settings sections
5. **SettingsNotification.svelte** - Settings change notifications

#### Routes
1. **+page.svelte** - Settings main page
2. **profile/+page.svelte** - Profile settings
3. **account/+page.svelte** - Account settings
4. **privacy/+page.svelte** - Privacy settings
5. **security/+page.svelte** - Security settings
6. **notifications/+page.svelte** - Notification settings

#### Features
- Real-time settings sync
- Unsaved changes warning
- Settings search/filter
- Settings reset to defaults
- Settings keyboard shortcuts
- Settings accessibility features

---

## Architecture Overview

### Settings Management Flow
```
User → Settings Page → Settings Component → Settings Store → API → Database
                                    ↓
                            Validation & Error Handling
                                    ↓
                            Success/Error Notification
```

### Data Flow
1. User navigates to settings page
2. Settings page loads user preferences from API
3. Settings stored in Svelte stores
4. User modifies settings in UI
5. Changes validated on client-side
6. Changes sent to API endpoint
7. API validates and saves to database
8. Success notification shown to user
9. Settings updated in store and UI

### State Management
- **settingsStore**: Main settings state
- **privacyStore**: Privacy settings state
- **securityStore**: Security settings state
- **notificationStore**: Notification preferences state
- **uiStore**: UI state (loading, errors, success messages)

---

## Database Schema Summary

### New Tables (8 total)
1. `user_settings` - General user settings
2. `user_profile_settings` - Profile information
3. `privacy_settings` - Privacy controls
4. `blocked_users` - Blocked users list
5. `audit_log` - Audit trail for sensitive operations
6. `user_security` - Security settings
7. `sessions` - Active user sessions
8. `login_history` - Login history
9. `notification_preferences` - Extended notification settings
10. `notification_delivery_log` - Notification delivery tracking

### Indexes
- `user_settings(user_id)` - Fast user lookup
- `privacy_settings(user_id)` - Fast privacy lookup
- `blocked_users(user_id, blocked_user_id)` - Fast block lookup
- `audit_log(user_id, created_at)` - Fast audit lookup
- `sessions(user_id, expires_at)` - Fast session lookup
- `login_history(user_id, created_at)` - Fast login lookup

---

## API Endpoints Summary

### Settings Endpoints (4)
- `GET /api/verified-vibe/settings` - Fetch settings
- `PUT /api/verified-vibe/settings` - Update settings
- `GET /api/verified-vibe/settings/profile` - Fetch profile
- `PUT /api/verified-vibe/settings/profile` - Update profile

### Privacy Endpoints (7)
- `GET /api/verified-vibe/privacy` - Fetch privacy settings
- `PUT /api/verified-vibe/privacy` - Update privacy settings
- `GET /api/verified-vibe/blocked-users` - Fetch blocked users
- `POST /api/verified-vibe/blocked-users` - Block user
- `DELETE /api/verified-vibe/blocked-users` - Unblock user
- `POST /api/verified-vibe/export-data` - Export data
- `DELETE /api/verified-vibe/account` - Delete account

### Security Endpoints (7)
- `POST /api/verified-vibe/change-password` - Change password
- `POST /api/verified-vibe/2fa/setup` - Setup 2FA
- `POST /api/verified-vibe/2fa/verify` - Verify 2FA
- `DELETE /api/verified-vibe/2fa` - Disable 2FA
- `GET /api/verified-vibe/sessions` - Fetch sessions
- `DELETE /api/verified-vibe/sessions/:id` - Logout session
- `GET /api/verified-vibe/login-history` - Fetch login history

### Notification Endpoints (4)
- `GET /api/verified-vibe/notification-preferences` - Fetch preferences
- `PUT /api/verified-vibe/notification-preferences` - Update preferences
- `GET /api/verified-vibe/notification-templates` - Fetch templates
- `POST /api/verified-vibe/notification-test` - Send test

**Total Endpoints**: 22

---

## Implementation Strategy

### Phase 6a: Settings Dashboard (Task 25)
1. Create settings page layout and navigation
2. Implement profile settings component
3. Implement account settings component
4. Implement preferences settings component
5. Create settings API endpoints
6. Create settings store
7. Add form validation
8. Add error handling and notifications

### Phase 6b: Privacy & Data (Task 26)
1. Create privacy settings component
2. Implement blocked users management
3. Implement data export feature
4. Implement account deletion
5. Create privacy API endpoints
6. Create privacy store
7. Add confirmation dialogs
8. Add audit logging

### Phase 6c: Security (Task 27)
1. Create security settings component
2. Implement password change
3. Implement 2FA setup
4. Implement session management
5. Implement login history
6. Create security API endpoints
7. Create security store
8. Add password strength indicator

### Phase 6d: Notifications (Task 28)
1. Extend notification preferences
2. Create email notification settings
3. Create push notification settings
4. Create SMS notification settings
5. Implement frequency controls
6. Create notification API endpoints
7. Create notification store
8. Add test notification feature

### Phase 6e: Integration (Task 29)
1. Create settings page layout
2. Integrate all components
3. Create settings routing
4. Implement state management
5. Add settings sync
6. Add settings backup/restore
7. Polish UI and animations
8. Add accessibility features

---

## Testing Strategy

### Unit Tests
- Settings form validation
- Privacy controls logic
- Security password validation
- Notification preference logic
- Store actions and mutations

### Integration Tests
- Settings API endpoints
- Privacy API endpoints
- Security API endpoints
- Notification API endpoints
- Database operations

### E2E Tests
- Complete settings workflow
- Privacy settings workflow
- Security settings workflow
- Notification settings workflow
- Account deletion workflow

### Manual Testing
- Settings page navigation
- Form submission and validation
- Error handling
- Success notifications
- Mobile responsiveness
- Accessibility compliance

---

## Success Criteria

### Functionality
- ✅ All settings can be viewed and updated
- ✅ Privacy controls work as expected
- ✅ Security features functional
- ✅ Notifications configurable
- ✅ Data export works
- ✅ Account deletion works

### Quality
- ✅ All code passes type checking
- ✅ All tests passing
- ✅ Build passes without errors
- ✅ No performance regressions
- ✅ Full accessibility compliance
- ✅ Mobile responsive

### Documentation
- ✅ API documentation complete
- ✅ Component documentation complete
- ✅ Database schema documented
- ✅ Implementation guide complete
- ✅ User guide complete

---

## Timeline

| Task | Duration | Start | End |
|------|----------|-------|-----|
| Task 25: Settings Dashboard | 8-10h | Day 1 | Day 1-2 |
| Task 26: Privacy & Data | 8-10h | Day 2 | Day 2-3 |
| Task 27: Security | 8-10h | Day 3 | Day 3-4 |
| Task 28: Notifications | 6-8h | Day 4 | Day 4 |
| Task 29: Integration | 6-8h | Day 4 | Day 4-5 |
| **TOTAL** | **36-46h** | **Day 1** | **Day 5** |

**Estimated Completion**: May 22-23, 2026

---

## Dependencies

### External Dependencies
- Supabase (database)
- SvelteKit (framework)
- Svelte stores (state management)
- TypeScript (type safety)

### Internal Dependencies
- Phase 5 components (notifications, search)
- Phase 5 services (real-time, typing, online status)
- Existing authentication system
- Existing user profiles

### No Breaking Changes
- All Phase 6 changes are additive
- Existing features remain unchanged
- Backward compatible with Phase 5

---

## Risk Assessment

### Low Risk
- Settings form validation
- UI component creation
- Store management
- API endpoint creation

### Medium Risk
- 2FA implementation (requires careful security handling)
- Account deletion (irreversible operation)
- Data export (large data handling)
- Session management (concurrent session handling)

### Mitigation Strategies
- Comprehensive testing for 2FA
- Confirmation dialogs for destructive operations
- Pagination for large data exports
- Session timeout handling
- Audit logging for sensitive operations

---

## Deliverables Summary

### Code
- ~4,000-5,000 lines of production code
- ~20-25 new components
- ~22 new API endpoints
- ~10 new database tables

### Documentation
- ~2,000 lines of documentation
- API documentation
- Component documentation
- Database schema documentation
- Implementation guide

### Testing
- Unit tests for all components
- Integration tests for all endpoints
- E2E tests for workflows
- Manual testing checklist

---

## Next Phase (Phase 7)

After Phase 6 completion, Phase 7 will focus on:
- Advanced Features (blocking, reporting, verification)
- Message Encryption
- Group Chat Support
- Voice/Video Calling
- Analytics & Monitoring

---

## Conclusion

Phase 6 will provide comprehensive user preferences and settings management, enabling users to customize their experience and control their privacy and security. The implementation will be modular, well-tested, and fully documented.

**Phase 6 Status**: READY FOR IMPLEMENTATION

---

**Plan Created**: May 18, 2026  
**Next Step**: Begin Task 25 - Settings Dashboard & Profile Management
