const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: String,
    image: String,
    price: String,
    category: String,
});

module.exports = mongoose.model('Product', productSchema);
