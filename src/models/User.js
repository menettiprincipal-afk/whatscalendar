const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  whatsappNumber: {
    type: String,
    required: true,
    unique: true
  },
  calendarEmail: {
    type: String,
    sparse: true
  },
  googleTokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
