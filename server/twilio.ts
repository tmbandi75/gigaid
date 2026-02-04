// Twilio integration for SMS notifications
import twilio from 'twilio';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    if (!fromNumber) {
      console.error('No Twilio phone number configured');
      return false;
    }

    // Clean the phone number - ensure it has country code
    let cleanTo = to.replace(/\D/g, '');
    if (cleanTo.length === 10) {
      cleanTo = '1' + cleanTo; // Add US country code
    }
    cleanTo = '+' + cleanTo;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: cleanTo
    });

    console.log(`SMS sent successfully to ${cleanTo}`);
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return false;
  }
}

// Enhanced version that returns message SID for tracking
export async function sendSMSWithTracking(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    if (!fromNumber) {
      return { success: false, error: 'No Twilio phone number configured' };
    }

    // Clean the phone number - ensure it has country code
    let cleanTo = to.replace(/\D/g, '');
    if (cleanTo.length === 10) {
      cleanTo = '1' + cleanTo; // Add US country code
    }
    cleanTo = '+' + cleanTo;

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: cleanTo
    });

    console.log(`[Twilio] SMS sent to ${cleanTo}, SID: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error: any) {
    console.error('[Twilio] Failed to send SMS:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

// Forward an inbound message to the provider's personal phone
export async function forwardSMSToProvider(providerPhone: string, fromPhone: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const forwardMessage = `Reply from ${fromPhone}:\n${body}`;
  return sendSMSWithTracking(providerPhone, forwardMessage);
}
