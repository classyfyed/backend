const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
    },
    password: String,
    firstName: String,
    lastName: String,
    validTill: Date,
    role: {
        type: String,
        enum: ['student', 'teacher', 'admin', 'college'],
        required: true,
    },
    college: String,
    verified: Boolean,
    verificationData: {
        idCard: String,
        teacherId: String,
        proofDocument: String,
    },
    registerOtp: Number,
    lastOtp: Date
});

module.exports = mongoose.model('User', userSchema);
