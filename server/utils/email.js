const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  // Use environment variables for email configuration
  // For development, you can use Gmail or other SMTP services
  // For production, use a service like SendGrid, AWS SES, etc.
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD
    }
  });

  return transporter;
};

// Send email notification
exports.sendEmail = async (to, subject, html, text = null) => {
  try {
    // Skip email sending if SMTP is not configured
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      console.log('Email not configured. Skipping email send to:', to);
      return { success: false, message: 'Email not configured' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Send notification email to user
exports.sendNotificationEmail = async (user, notification) => {
  try {
    if (!user || !user.email) {
      console.log('User email not available');
      return { success: false, message: 'User email not available' };
    }

    const emailSubject = notification.title || 'New Notification';
    
    // Create HTML email template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3498db; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .message { margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>GIC Projects</h1>
          </div>
          <div class="content">
            <h2>${emailSubject}</h2>
            <div class="message">
              <p>${notification.message}</p>
            </div>
            <p>Please log in to your dashboard to view more details.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification from GIC Projects.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(user.email, emailSubject, emailHtml);
  } catch (error) {
    console.error('Error sending notification email:', error);
    return { success: false, error: error.message };
  }
};

