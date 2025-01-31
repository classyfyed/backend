const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    firstName: String,
    lastName: String,
    validTill: Date,
    role: {
        type: String,
        enum: ['student', 'teacher', 'admin', 'college'],
        required: true,
    },
    college: { type: mongoose.Schema.Types.ObjectId, ref: 'College' },
    verified: Boolean,
    verificationData: {
        idCard: String,
        emailExtension: String,
        teacherId: String,
        proofDocument: String,
    },
});

module.exports = mongoose.model('User', userSchema);
