# Email Notification Setup

This system supports email notifications for all important events. To enable email notifications, you need to configure SMTP settings.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com

# Alternative (simpler) configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## Gmail Setup

If using Gmail:

1. Enable 2-Step Verification on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password in `SMTP_PASS` or `EMAIL_PASSWORD`

## Other Email Providers

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
```

### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-aws-access-key
SMTP_PASS=your-aws-secret-key
EMAIL_FROM=noreply@yourdomain.com
```

## Testing

The system will gracefully handle missing email configuration. If email is not configured, notifications will still be created in the database, but emails will not be sent. Check the server logs for email sending status.

## Email Notifications Sent

The system sends email notifications for:
- User onboarding
- Project creation and updates
- Task assignments and submissions
- Task reviews
- Comments on projects
- Team member additions/removals
- Client removals
- Project auto-completion

