import axios from 'axios';
import qs from 'qs';
import { prisma } from '../../config/db';
import { redisConnection } from '../../config/redis';

const SLACK_API_URL = 'https://slack.com/api';

export const exchangeSlackToken = async (code: string) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Slack OAuth configuration is missing');
  }

  const response = await axios.post(`${SLACK_API_URL}/oauth.v2.access`, qs.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  }), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.data.ok) {
    throw new Error(`Slack OAuth error: ${response.data.error}`);
  }

  return response.data;
};

export const sendSlackNotification = async (senderId: string, message: string) => {
  try {
    // Look up the user for the sender
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
      include: {
        user: {
          include: {
            slackConnections: true,
          }
        }
      }
    });

    if (!sender) return;

    const slackConn = sender.user?.slackConnections?.[0];
    if (!slackConn) {
      console.log(`[Slack] No Slack connection for user ${sender.userId} (Sender: ${senderId}). Skipping notification.`);
      return;
    }

    // Deduplication using Redis lock for the hour
    // Key format: slack-rate-alert:{senderId}:{hourBucket}
    const now = new Date();
    const hourBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
    const alertKey = `slack-rate-alert:${senderId}:${hourBucket}`;
    
    // Set NX (only if it doesn't exist), EX (expire in 1 hour)
    const acquired = await redisConnection.set(alertKey, '1', 'EX', 3600, 'NX');
    if (!acquired) {
      console.log(`[Slack] Notification already sent for ${senderId} in this hour. Skipping.`);
      return;
    }

    // Send the Slack message
    // We send it to the user's ID as a direct message (using chat.postMessage to the user's ID or incoming webhook)
    // Slack OAuth returns authed_user.id. We can use chat.postMessage with channel = slackConn.slackTeamId or authed_user.id
    
    const targetChannel = slackConn.channelId || sender.user.slackConnections[0].id; // Fallback or we just try sending to channelId

    const response = await axios.post(`${SLACK_API_URL}/chat.postMessage`, {
      channel: targetChannel,
      text: message,
    }, {
      headers: {
        Authorization: `Bearer ${slackConn.accessToken}`,
      }
    });

    if (!response.data.ok) {
      console.error(`[Slack] Failed to send message: ${response.data.error}`);
    } else {
      console.log(`[Slack] Notification sent successfully for sender ${senderId}`);
    }
  } catch (error: any) {
    console.error('[Slack] Unexpected error sending notification:', error.message);
  }
};
