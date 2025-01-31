const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const connectMongo = require('./utils/connectMongo');
const User = require('./models/User');
const College = require('./models/College');
const Product = require('./models/Product');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

connectMongo();

const secretKey = process.env.SECRET_KEY;
const baseUrl = process.env.BASE_URL;

const transporter = nodemailer.createTransport({
    host: "smtp.zoho.in",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_ID,
        pass: process.env.EMAIL_PASSWORD,
    },
});

const sendVerificationEmail = (user, token) => {
    return new Promise((resolve, reject) => {
        const emailTemplatePath = path.join(__dirname, 'templates', 'verificationEmail.html');
        const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf8');
        const verificationLink = `${baseUrl}/api/verify-email?token=${token}`;
        const emailContent = emailTemplate.replace('{{verificationLink}}', verificationLink);

        const mailOptions = {
            from: process.env.EMAIL_ID,
            to: user.email,
            subject: 'Email Verification',
            html: emailContent,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject('Error sending email: ' + error);
            } else {
                resolve(info.response);
            }
        });
    });
};

const sendCustomEmail = (email) => {
    return new Promise((resolve, reject) => {
        const emailTemplatePath = path.join(__dirname, 'templates', 'customEmail.html');
        const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf8');

        const mailOptions = {
            from: `ClassyFYed <${process.env.EMAIL_ID}>`,
            to: email,
            subject: 'Test Email',
            html: emailTemplate,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject('Error sending email: ' + error);
            } else {
                resolve(info.response);
            }
        });
    });
};

const sendOtpEmail = (email, otp) => {
    return new Promise((resolve, reject) => {
        const emailTemplatePath = path.join(__dirname, 'templates', 'otpEmail.html');
        const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf8');
        const emailContent = emailTemplate.replace('{{otp}}', otp);

        const mailOptions = {
            from: `ClassyFYed OTP Service <${process.env.EMAIL_ID}>`,
            to: email,
            subject: 'Your OTP Code',
            html: emailContent,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject('Error sending email: ' + error);
            } else {
                resolve(info.response);
            }
        });
    });
};

// Sample data for the API
const sampleData = {
    recommended: [
        {
            id: 1,
            name: 'Laptop Discount',
            image: 'https://via.placeholder.com/150?text=Laptop',
            price: '$799',
        },
        {
            id: 2,
            name: 'Smartphone Deal',
            image: 'https://via.placeholder.com/150?text=Smartphone',
            price: '$499',
        },
        {
            id: 3,
            name: 'Headphones Sale',
            image: 'https://via.placeholder.com/150?text=Headphones',
            price: '$99',
        },
    ],
    sponsored: [
        {
            id: 1,
            name: 'Buy 1 Get 1 Free Shoes',
            image: 'https://via.placeholder.com/150?text=Shoes',
            price: '$50',
        },
        {
            id: 2,
            name: 'Exclusive Fitness Equipment',
            image: 'https://via.placeholder.com/150?text=Fitness',
            price: '$199',
        },
        {
            id: 3,
            name: 'Gaming Console Discount',
            image: 'https://via.placeholder.com/150?text=Console',
            price: '$399',
        },
    ],
    categories: [
        { id: 1, name: 'Electronics' },
        { id: 2, name: 'Clothing' },
        { id: 3, name: 'Books' },
        { id: 4, name: 'Food' },
    ],
};

app.get('/', (req, res) => {
    res.send('Jai Srimannarayana!!');
});

app.get('/api/data', (req, res) => {
    res.json(sampleData);
});

app.post('/api/register', async (req, res) => {
    const { name, email, password, role, college } = req.body;
    try {
        const user = new User({ name, email, password, role, college, verified: false });
        await user.save();
        const token = jwt.sign({ userId: user._id, email: user.email }, secretKey, { expiresIn: '1h' });
        await sendVerificationEmail(user, token);
        res.status(201).send('User registered. Please check your email to verify your account.');
    } catch (error) {
        res.status(500).send('Server error');
    }
});

app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;
    try {
        const decoded = jwt.verify(token, secretKey);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).send('User not found');
        }
        const college = await College.findOne({ shortcode: user.college });
        const emailDomain = user.email.split('@')[1];
        if (college.emailExtensions.includes(emailDomain)) {
            user.verified = true;
        } else {
            user.verified = false;
        }
        await user.save();
        res.send('Email verified successfully');
    } catch (error) {
        res.status(400).send('Invalid or expired token');
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || user.password !== password) {
            return res.status(401).send('Invalid credentials');
        }
        const token = jwt.sign({ userId: user._id, role: user.role }, secretKey, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).send('Server error');
    }
});

const authenticate = (req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');
    if (!token) {
        return res.status(401).send('Access denied');
    }
    try {
        const decoded = jwt.verify(token, secretKey);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).send('Invalid token');
    }
};

app.post('/api/verify', authenticate, async (req, res) => {
    const { userId, verificationData } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('User not found');
        }
        const college = await College.findOne({ shortcode: user.college });
        const emailDomain = verificationData.email.split('@')[1];
        if (college.emailExtensions.includes(emailDomain)) {
            user.verified = true;
            await user.save();
            return res.send('User verified via email');
        } else {
            if (req.user.role === 'admin' || req.user.role === 'collegeAdmin') {
                user.verificationData = verificationData;
                user.verified = true;
                await user.save();
                return res.send('User manually verified by admin');
            }
            return res.status(403).send('Manual verification required by admin');
        }
    } catch (error) {
        res.status(500).send('Server error');
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

app.post('/api/products', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access denied');
    }
    const product = new Product(req.body);
    try {
        await product.save();
        res.status(201).send(product);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.put('/api/products/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access denied');
    }
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!product) {
            return res.status(404).send('Product not found');
        }
        res.send(product);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.delete('/api/products/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access denied');
    }
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).send('Product not found');
        }
        res.send(product);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.get('/api/colleges', async (req, res) => {
    const { search } = req.query;
    try {
        const query = search ? { name: { $regex: search, $options: 'i' } } : {};
        const colleges = await College.find(query);
        res.json(colleges);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

app.post('/api/colleges', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access denied');
    }
    const college = new College(req.body);
    try {
        await college.save();
        res.status(201).send(college);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.put('/api/colleges/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access denied');
    }
    try {
        const college = await College.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!college) {
            return res.status(404).send('College not found');
        }
        res.send(college);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.delete('/api/colleges/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access denied');
    }
    try {
        const college = await College.findByIdAndDelete(req.params.id);
        if (!college) {
            return res.status(404).send('College not found');
        }
        res.send(college);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.post('/api/test', async (req, res) => {
    const { email } = req.body;
    try {
        await sendCustomEmail(email);
        res.send('Custom email sent successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        await sendOtpEmail(email, otp);
        // Save OTP to user record or a temporary store
        await User.updateOne({ email }, { otp });
        res.send('OTP sent successfully');
    } catch (error) {
        res.status(500).send('Error sending OTP');
    }
});

app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email, otp });
        if (!user) {
            return res.status(400).send('Invalid OTP');
        }
        user.verified = true;
        user.otp = null;
        await user.save();
        res.send('Email verified successfully');
    } catch (error) {
        res.status(500).send('Server error');
    }
});

app.post('/api/upload-id', async (req, res) => {
    const { email, college } = req.body;
    const idCard = req.files.idCard;
    const uploadPath = path.join(__dirname, 'uploads', idCard.name);

    idCard.mv(uploadPath, async (err) => {
        if (err) {
            return res.status(500).send('Error uploading ID card');
        }
        try {
            const user = await User.findOne({ email });
            user.college = college;
            user.idCardPath = uploadPath;
            user.verified = false;
            await user.save();
            res.send('ID card uploaded successfully. Please wait for manual verification.');
        } catch (error) {
            res.status(500).send('Server error');
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
