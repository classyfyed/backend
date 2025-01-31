const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
    name: String,
    shortCode: {
        type: String,
        unique: true,
        required: true
    },
    emailExtensions: [String],
});

module.exports = mongoose.model('College', collegeSchema);
