import nodemailer from 'nodemailer';
import { IncomingWebhook } from '@slack/webhook';
import logger from './enhanced-logger';

// Interface for notification configuration
interface NotificationConfig {
  email?: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    recipients: string[];
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
  };
}

class NotificationManager {
  private emailTransporter: nodemailer.Transporter | null = null;
  private slackWebhook: IncomingWebhook | null = null;
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
    this.initEmailTransporter();
    this.initSlackWebhook();
  }

  private initEmailTransporter(): void {
    if (this.config.email?.enabled) {
      try {
        this.emailTransporter = nodemailer.createTransport({
          host: this.config.email.host,
          port: this.config.email.port,
          secure: this.config.email.secure,
          auth: {
            user: this.config.email.auth.user,
            pass: this.config.email.auth.pass,
          },
        });
        logger.info('Email notification transport initialized');
      } catch (error) {
        logger.error('Failed to initialize email transport', error as Error);
      }
    }
  }

  private initSlackWebhook(): void {
    if (this.config.slack?.enabled && this.config.slack.webhookUrl) {
      try {
        this.slackWebhook = new IncomingWebhook(this.config.slack.webhookUrl);
        logger.info('Slack webhook initialized');
      } catch (error) {
        logger.error('Failed to initialize Slack webhook', error as Error);
      }
    }
  }

  /**
   * Send an email notification
   * @param subject Email subject
   * @param message Email message content
   * @returns Promise resolving to success status
   */
  async sendEmailNotification(subject: string, message: string): Promise<boolean> {
    if (!this.emailTransporter || !this.config.email?.enabled) {
      logger.warn('Email notifications are not configured or disabled');
      return false;
    }

    try {
      const info = await this.emailTransporter.sendMail({
        from: this.config.email.auth.user,
        to: this.config.email.recipients.join(','),
        subject: `[BOT Alert] ${subject}`,
        text: message,
        html: `<div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #e53e3e;">⚠️ Bot Alert: ${subject}</h2>
                <div style="padding: 15px; background-color: #f8f8f8; border-left: 4px solid #e53e3e; margin: 10px 0;">
                  <pre style="white-space: pre-wrap;">${message}</pre>
                </div>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">
                  This is an automated message from your Facebook Messenger Bot.
                </p>
              </div>`,
      });

      logger.info(`Email notification sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email notification', error as Error);
      return false;
    }
  }

  /**
   * Send a Slack notification
   * @param title Notification title
   * @param message Notification message
   * @param level Severity level (error, warn, info)
   * @returns Promise resolving to success status
   */
  async sendSlackNotification(
    title: string,
    message: string,
    level: 'error' | 'warn' | 'info' = 'info'
  ): Promise<boolean> {
    if (!this.slackWebhook || !this.config.slack?.enabled) {
      logger.warn('Slack notifications are not configured or disabled');
      return false;
    }

    // Set color based on level
    const colors = {
      error: '#e53e3e',
      warn: '#dd6b20',
      info: '#3182ce',
    };

    // Set icon based on level
    const icons = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
    };

    try {
      await this.slackWebhook.send({
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${icons[level]} ${title}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `\`\`\`${message}\`\`\``,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Time:* ${new Date().toISOString()}`,
              },
            ],
          },
        ],
        attachments: [
          {
            color: colors[level],
            footer: 'Facebook Messenger Bot',
          },
        ],
      });

      logger.info(`Slack notification sent: ${title}`);
      return true;
    } catch (error) {
      logger.error('Failed to send Slack notification', error as Error);
      return false;
    }
  }

  /**
   * Send a critical error notification to all configured channels
   * @param title Error title
   * @param error Error object or message
   */
  async notifyCriticalError(title: string, error: Error | string): Promise<void> {
    const errorMessage = error instanceof Error
      ? `${error.message}\n\nStack Trace:\n${error.stack}`
      : error;

    // Send to all configured notification channels
    const emailPromise = this.sendEmailNotification(title, errorMessage);
    const slackPromise = this.sendSlackNotification(title, errorMessage, 'error');

    await Promise.allSettled([emailPromise, slackPromise]);
  }
}

// Create a singleton instance with default empty config
// (will be configured later from environment variables)
const notificationManager = new NotificationManager({
  email: {
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    auth: {
      user: '',
      pass: '',
    },
    recipients: [],
  },
  slack: {
    enabled: false,
    webhookUrl: '',
  },
});

export default notificationManager;

// Export the class for testing and custom instances
export { NotificationManager, NotificationConfig };