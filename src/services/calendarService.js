const { google } = require('googleapis');
const User = require('../models/User');

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

const getAuthUrl = (whatsappNumber) => {
  const oauth2Client = getOAuthClient();
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly', 
    'https://www.googleapis.com/auth/userinfo.email'
  ];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: whatsappNumber // Passamos o telefone para resgatar no callback
  });
};

const handleCallback = async (code, whatsappNumber) => {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  
  let user = await User.findOne({ whatsappNumber });
  if (!user) {
    user = new User({ whatsappNumber });
  }
  user.calendarEmail = userInfo.data.email;
  // IMPORTANTE: Só atualiza os tokens se veio um refresh token novo (prompt: consent forçou isso)
  if (tokens.refresh_token) {
    user.googleTokens = tokens;
  } else if (!user.googleTokens || !user.googleTokens.refresh_token) {
    // Caso seja um re-login mas o Google não devolveu refresh token.
    user.googleTokens = Object.assign({}, user.googleTokens, tokens);
  } else {
    user.googleTokens.access_token = tokens.access_token;
    user.googleTokens.expiry_date = tokens.expiry_date;
  }

  await user.save();
  return user;
};

const getTodaysEvents = async (userTokens) => {
  const client = getOAuthClient();
  client.setCredentials(userTokens);
  const calendar = google.calendar({ version: 'v3', auth: client });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items || [];
};

module.exports = { getAuthUrl, handleCallback, getTodaysEvents, getOAuthClient };
