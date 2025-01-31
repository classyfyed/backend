const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
    name: String,
    emailExtensions: [String],
});

module.exports = mongoose.model('College', collegeSchema);
