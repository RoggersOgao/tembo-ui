export interface EmailTemplate {
  subject: string;
  html: (data: any) => string;
  text?: (data: any) => string;
}

// Helper function to convert template literals to single line strings
const inline = (style: string) => style.replace(/\s+/g, ' ').trim();

// Basic styles for email compatibility
const styles = {
  container: inline(`
    max-width: 600px; 
    margin: 0 auto; 
    background: #ffffff; 
    border: 1px solid #e5e7eb;
    font-family: 'Onest','Open Sans',Helvetica,Arial,sans-serif;
  `),

  body: inline(`
    font-family: 'Onest','Open Sans',Helvetica,Arial,sans-serif;
    line-height: 1.5; 
    color: #111827;
    margin: 0; 
    padding: 20px;
  `),

  content: inline(`
    padding: 30px 20px;
    background: #ffffff;
  `),

  button: inline(`
    display: inline-block; 
    padding: 12px 24px; 
    background: #000000; 
    color: #ffffff; 
    text-decoration: none; 
    border-radius: 80px; 
    font-weight: bold; 
    font-size: 14px; 
    text-align: center; 
  `),

  secondaryButton: inline(`
    display: inline-block; 
    padding: 12px 24px; 
    background: transparent; 
    color: #000000; 
    text-decoration: none; 
    border-radius: 4px; 
    font-weight: bold; 
    font-size: 14px; 
    font-family: 'Google Sans','Open Sans',Helvetica,Arial,sans-serif;
    text-align: center; 
    border: 1px solid #000000;
  `),

  footer: inline(`
    text-align: center; 
    padding: 20px; 
    color: #6B7280; 
    font-size: 12px; 
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  `),

  link: inline(`
    color: #000000; 
    text-decoration: underline; 
  `),

  alertBox: (color: string) => inline(`
    background: #fef2f2;
    border: 1px solid ${color};
    padding: 15px;
    margin: 20px 0;
    border-radius: 4px;
  `),

  detailsBox: inline(`
    padding: 20px;
    border-radius: 4px;
    margin: 20px 0;
  `),

  card: inline(`
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 20px;
    margin-bottom: 20px;
  `),

  codeDisplay: inline(`
    font-size: 48px;
    font-family: 'Onest','Open Sans',Helvetica,Arial,sans-serif;
    font-weight: bold;
    color: #000000;
    padding: 12px 20px;
    display: inline-block;
  `),

  codeContainer: inline(`
    border-radius: 4px;
    padding: 20px;
    text-align: center;
    margin: 20px 0;
  `),

  heading1: inline(`
    color: #000000;
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 20px;
    text-align: center;
  `),

  heading2: inline(`
    color: #000000;
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 15px;
  `),

  paragraph: inline(`
    font-size: 14px;
    line-height: 1.5;
    color: #374151;
    margin-bottom: 15px;
  `),

  strong: inline(`
    color: #000000;
    font-weight: bold;
  `),

  listItem: inline(`
    margin-bottom: 8px;
    padding-left: 20px;
    font-size: 14px;
    color: #374151;
  `)
};

function getSeverityColor(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): string {
  switch (severity) {
    case 'CRITICAL': return '#dc3545';
    case 'HIGH': return '#fd7e14';
    case 'MEDIUM': return '#ffc107';
    case 'LOW': return '#28a745';
    default: return '#6c757d';
  }
}

const severityColors = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
  CRITICAL: '#DC2626'
} as const;

type SeverityLevel = keyof typeof severityColors;

export const emailTemplates: Record<string, EmailTemplate> = {

  securityAlert: {
    subject: 'Security Alert',
    html: (data: {
      userName: string;
      message: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      timestamp: string;
      [key: string]: any;
    }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
       
          <div style="${styles.content}">
            <p style="${styles.paragraph}">Hello ${data.userName},</p>
            <p style="${styles.paragraph}">We detected a ${data.severity.toLowerCase()} security event on your account:</p>
            
            <div style="background: ${getSeverityColor(data.severity)}20; border: 1px solid ${getSeverityColor(data.severity)}; padding: 10px; border-radius: 4px; margin: 20px 0;">
              <p style="margin:0; font-weight: bold; color: ${getSeverityColor(data.severity)};">${data.severity} SEVERITY</p>
            </div>
            
            <div style="${styles.detailsBox}">
              <p style="margin:0 0 10px 0;"><strong>Message:</strong> ${data.message}</p>
              <p style="margin:0 0 10px 0;"><strong>Time:</strong> ${data.timestamp}</p>
              ${data.ipAddress ? `<p style="margin:0 0 10px 0;"><strong>IP Address:</strong> ${data.ipAddress}</p>` : ''}
              ${data.location ? `<p style="margin:0 0 10px 0;"><strong>Location:</strong> ${data.location}</p>` : ''}
              ${data.deviceName ? `<p style="margin:0;"><strong>Device:</strong> ${data.deviceName}</p>` : ''}
            </div>
            
            <p style="${styles.paragraph}"><strong>If this was you:</strong> No action required.</p>
            <p style="${styles.paragraph}"><strong>If this wasn't you:</strong></p>
            <ul style="padding-left: 20px;">
              <li style="${styles.listItem}">Change your password immediately</li>
              <li style="${styles.listItem}">Review your recent account activity</li>
              <li style="${styles.listItem}">Contact support</li>
            </ul>
            
            <p style="${styles.paragraph}">Stay safe,<br>The Security Team</p>
          </div>
          <div style="${styles.footer}">
            <p style="margin:0;">This is an automated security alert. Please do not reply.</p>
            <p style="margin:5px 0 0;">© ${new Date().getFullYear()} Your Company. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data: any) => `
SECURITY ALERT

Hello ${data.userName},

We detected a ${data.severity.toLowerCase()} security event on your account:

SEVERITY: ${data.severity}
MESSAGE: ${data.message}
TIME: ${data.timestamp}
${data.ipAddress ? `IP ADDRESS: ${data.ipAddress}` : ''}
${data.location ? `LOCATION: ${data.location}` : ''}
${data.deviceName ? `DEVICE: ${data.deviceName}` : ''}

If this was you: No action required.

If this wasn't you:
1. Change your password immediately
2. Review your recent account activity
3. Contact support

Stay safe,
The Security Team

This is an automated security alert. Please do not reply.
    `
  },

  suspiciousLogin: {
    subject: 'Suspicious Login Attempt Detected',
    html: (data: {
      userName: string;
      location?: string;
      ipAddress?: string;
      deviceName?: string;
      timestamp: string;
      confidence: number;
    }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <div style="${styles.content}">
            <p style="${styles.paragraph}">Hello ${data.userName},</p>
            <p style="${styles.paragraph}">We detected a suspicious login attempt to your account.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin:0; color: #856404;"><strong>[!] SECURITY WARNING:</strong> This login attempt requires your attention.</p>
            </div>
            
            <div style="${styles.detailsBox}">
              <h3 style="margin:0 0 10px 0; font-size: 16px;">Login Details:</h3>
              <p style="margin:0 0 10px 0;"><strong>Time:</strong> ${data.timestamp}</p>
              ${data.ipAddress ? `<p style="margin:0 0 10px 0;"><strong>IP Address:</strong> ${data.ipAddress}</p>` : ''}
              ${data.location ? `<p style="margin:0 0 10px 0;"><strong>Location:</strong> ${data.location}</p>` : ''}
              ${data.deviceName ? `<p style="margin:0 0 10px 0;"><strong>Device:</strong> ${data.deviceName}</p>` : ''}
              <p style="margin:0;"><strong>Suspicion Confidence:</strong> ${Math.round(data.confidence * 100)}%</p>
            </div>
            
            <p style="${styles.paragraph}"><strong>If this was you:</strong> You can ignore this alert.</p>
            <p style="${styles.paragraph}"><strong>If this wasn't you:</strong></p>
            <ol style="padding-left: 20px;">
              <li style="${styles.listItem}">Change your password immediately</li>
              <li style="${styles.listItem}">Enable two-factor authentication</li>
              <li style="${styles.listItem}">Review your account activity</li>
              <li style="${styles.listItem}">Contact support</li>
            </ol>
            
            <p style="${styles.paragraph}">Best regards,<br>Security Team</p>
          </div>
          <div style="${styles.footer}">
            <p style="margin:0;">This is an automated security alert. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data: any) => `
SUSPICIOUS LOGIN ATTEMPT DETECTED

Hello ${data.userName},

We detected a suspicious login attempt to your account.

[!] SECURITY WARNING: This login attempt requires your attention.

LOGIN DETAILS:
Time: ${data.timestamp}
${data.ipAddress ? `IP Address: ${data.ipAddress}` : ''}
${data.location ? `Location: ${data.location}` : ''}
${data.deviceName ? `Device: ${data.deviceName}` : ''}
Suspicion Confidence: ${Math.round(data.confidence * 100)}%

If this was you: You can ignore this alert.

If this wasn't you:
1. Change your password immediately
2. Enable two-factor authentication
3. Review your account activity
4. Contact support

Best regards,
Security Team
    `
  },

  verification: {
    subject: 'Verify Your Email Address',
    html: (data: { confirmLink: string; userName?: string; companyName?: string }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <div style="${styles.content}">
            <h1 style="${styles.heading1}">Verify your email address</h1>
            <p style="${styles.paragraph}">Hello ${data.userName || 'there'},</p>
            <p style="${styles.paragraph}">Please verify that this email address belongs to you.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.confirmLink}" style="${styles.button}">VERIFY EMAIL</a>
            </div>
            
            <div style="${styles.detailsBox}">
              <p style="font-size: 13px; color: #6B7280; margin:0 0 10px 0; text-align: center;">Or paste this link:</p>
              <p style="font-size: 12px; color: #000000; word-break: break-all; text-align: center; margin:0;">
                <a href="${data.confirmLink}" style="${styles.link}">${data.confirmLink}</a>
              </p>
            </div>
            
            <p style="font-size: 12px; color: #9CA3AF; text-align: center;">If you did not request this automated email please do ignore.</p>
          </div>
          <div style="${styles.footer}">
            <p style="margin:0;">© ${new Date().getFullYear()} intellisirn. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data) => `Verify Your Email\n\nHello ${data.userName || 'there'},\n\nPlease verify your email: ${data.confirmLink}`
  },

  twoFactor: {
    subject: 'Your Security Code',
    html: (data: { code: string; userName?: string; expiresIn?: string }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <div style="${styles.content}">
            <h1 style="${styles.heading1}">SECURITY CODE</h1>
            <p style="text-align: center; color: #4B5563; font-size: 14px;">Use the following code to complete your login:</p>
            
            <div style="${styles.codeContainer}">
              <div style="${styles.codeDisplay}">${data.code}</div>
              <p style="font-size: 13px; color: #6B7280; margin:15px 0 0;">Valid for ${data.expiresIn || '10 minutes'}</p>
            </div>
            
            <div style="${styles.alertBox('#F59E0B')}">
              <p style="margin:0; font-size: 12px; color: #92400E;">We will never ask for this code via phone or email.</p>
            </div>
          </div>
          <div style="${styles.footer}">
            <p style="margin:0;">© ${new Date().getFullYear()} intellisirn.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data) => `Your Login Code: ${data.code}`
  },

  passwordReset: {
    subject: 'Reset Your Password',
    html: (data: { resetLink: string; expires?: Date }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <div style="${styles.content}">
            <h1 style="${styles.heading1}">Forgot your password?</h1>
            <p style="${styles.paragraph} text-align: center;">Click the button below to reset your password.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.resetLink}" style="${styles.button}">RESET PASSWORD</a>
            </div>
            
            <p style="font-size: 12px; color: #9CA3AF; text-align: center;">If you didn't request this, please ignore this email.</p>
          </div>
          <div style="${styles.footer}">
            <p style="margin:0;">© ${new Date().getFullYear()} intellisirn.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data) => `Reset your password here: ${data.resetLink}`
  },

  welcome: {
    subject: 'Welcome Aboard!',
    html: (data: { userName: string; dashboardLink?: string }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <div style="${styles.content}">
            <h1 style="${styles.heading1}">Welcome, ${data.userName}!</h1>
            <p style="${styles.paragraph} text-align: center;">We are thrilled to have you with us.</p>
            
            <div style="${styles.card}">
              <h3 style="margin:0 0 15px 0; font-size: 16px;">Quick Start Guide:</h3>
              <ul style="padding-left: 20px; margin:0;">
                <li style="${styles.listItem}">Complete your profile</li>
                <li style="${styles.listItem}">Browse the marketplace</li>
                <li style="${styles.listItem}">Connect with peers</li>
              </ul>
            </div>
            
            ${data.dashboardLink ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.dashboardLink}" style="${styles.button}">GO TO DASHBOARD</a>
              </div>
            ` : ''}
          </div>
          <div style="${styles.footer}">
            <p style="margin:0;">© ${new Date().getFullYear()} intellisirn. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data) => `Welcome ${data.userName}! We are glad you are here.`
  },

  deviceVerification: {
    subject: 'Verify Your New Device',
    html: (data: { userName: string; verificationCode: string; deviceName: string; expiresIn?: string; browser?: string; location?: string; ipAddress?: string; }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <div style="${styles.content}">
            <h1 style="${styles.heading1}">Verify Your New Device</h1>
            <p style="${styles.paragraph}">Hello ${data.userName},</p>
            <p style="${styles.paragraph}">A new device has been registered to your account and requires verification.</p>

            <div style="${styles.codeContainer}">
              <p style="font-size: 14px; margin:0 0 15px;">Verification Code:</p>
              <div style="${styles.codeDisplay}">${data.verificationCode}</div>
              <p style="font-size: 12px; color: #6B7280; margin:15px 0 0;">Expires in ${data.expiresIn || '15 minutes'}</p>
            </div>
            
          </div>
          <div style="${styles.footer}">
            <p style="margin:0;">© ${new Date().getFullYear()} intellisirn. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data) => `Device Verification\n\nHello ${data.userName},\n\nA new device has been registered to your account:\n\nDevice: ${data.deviceName}\n${data.browser ? `Browser: ${data.browser}\n` : ''}${data.location ? `Location: ${data.location}\n` : ''}${data.ipAddress ? `IP: ${data.ipAddress}\n` : ''}\n\nVerification Code: ${data.verificationCode}\n\nCode expires in ${data.expiresIn || '15 minutes'}.`
  },

  deviceVerifiedSuccessfully: {
    subject: 'Device Successfully Verified',
    html: (data: { userName: string; deviceName: string; verificationTime: string; browser?: string; deviceType?: string; }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="${styles.body}">
        <div style="${styles.container}">
          <div style="${styles.content}">
            <h1 style="${styles.heading1}">Device Successfully Verified</h1>
            <p style="${styles.paragraph} text-align: center;">Hello ${data.userName},</p>
            <p style="${styles.paragraph} text-align: center;">Your device has been successfully verified.</p>
            
            <div style="${styles.card}">
              <h3 style="margin:0 0 15px 0; font-size: 16px;">Verification Summary:</h3>
              <p style="margin:0 0 8px 0;"><strong>Device:</strong> ${data.deviceName}</p>
              <p style="margin:0 0 8px 0;"><strong>Verified on:</strong> ${data.verificationTime}</p>
              ${data.deviceType ? `<p style="margin:0 0 8px 0;"><strong>Device Type:</strong> ${data.deviceType}</p>` : ''}
              ${data.browser ? `<p style="margin:0;"><strong>Browser:</strong> ${data.browser}</p>` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" style="${styles.button}">GO TO DASHBOARD</a>
            </div>
            
            <div style="${styles.alertBox('#EF4444')}">
              <p style="margin:0; font-size: 12px;">You can remove this device from your trusted list at any time.</p>
            </div>
          </div>
          <div style="${styles.footer}">
            <p style="margin:0;">© ${new Date().getFullYear()} intellisirn. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data) => `Device Verification Complete\n\nHello ${data.userName},\n\nYour device "${data.deviceName}" has been successfully verified.\n\nVerified On: ${data.verificationTime}\n${data.deviceType ? `Device Type: ${data.deviceType}\n` : ''}${data.browser ? `Browser: ${data.browser}\n` : ''}`
  }
};