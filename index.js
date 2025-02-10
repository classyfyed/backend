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
    const { firstName, lastName, email, password, role, college } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered', error: true });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const user = new User({ firstName, lastName, email, password, role, college, verified: false, registerOtp: otp });
        await user.save();
        await sendOtpEmail(email, otp);
        res.status(201).json({ message: 'User registered. Please check your email to verify your account.', success: true });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message, error: true });
    }
});

app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const user = await User.findOne({ email });
        if (user.lastOtp && new Date() - user.lastOtp < 60000) {
            return res.status(400).json({ message: 'Please wait before sending OTP again', error: true });
        }
        user.registerOtp = otp;
        user.lastOtp = new Date();
        await user.save();
        await sendOtpEmail(email, otp);
        res.json({ message: 'OTP sent successfully', success: true });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Error sending OTP', error: true });
    }
});

app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;
    try {
        const decoded = jwt.verify(token, secretKey);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found', error: true });
        }
        const college = await College.findOne({ shortcode: user.college });
        const emailDomain = user.email.split('@')[1];
        if (college.emailExtensions.includes(emailDomain)) {
            user.verified = true;
        } else {
            user.verified = false;
        }
        await user.save();
        res.json({ message: 'Email verified successfully', success: true });
    } catch (error) {
        res.status(400).json({ message: 'Invalid or expired token', error: true });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user.verified) {
            return res.status(403).json({ message: 'User not verified', error: true, userId: user._id });
        }
        if (!user || user.password !== password) {
            return res.status(401).json({ message: 'Invalid credentials', error: true });
        }
        const token = jwt.sign({ userId: user._id, role: user.role }, secretKey, { expiresIn: '1h' });
        res.json({ token, success: true });
    } catch (error) {
        res.status(500).json({ message: error.message, error: true });
    }
});

app.post('/api/login-user', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user.verified) {
            return res.status(403).json({ message: 'User not verified', error: true, userId: user._id });
        }
        if (!user || user.password !== password) {
            return res.status(401).json({ message: 'Invalid credentials', error: true });
        }
        const userObj = user.toObject();
        delete userObj.password;
        res.json({ user: userObj, success: true });
    } catch (error) {
        res.status(500).json({ message: error.message, error: true });
    }
});

const authenticate = (req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Access denied', error: true });
    }
    try {
        const decoded = jwt.verify(token, secretKey);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ message: 'Invalid token', error: true });
    }
};

const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied', error: true });
        }
        next();
    };
};

app.post('/api/verify', authenticate, checkRole(['admin', 'college']), async (req, res) => {
    const { userId, verificationData } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found', error: true });
        }
        const college = await College.findOne({ shortcode: user.college });
        const emailDomain = verificationData.email.split('@')[1];
        if (college.emailExtensions.includes(emailDomain)) {
            user.verified = true;
            await user.save();
            return res.json({ message: 'User verified via email', success: true });
        } else {
            if (req.user.role === 'admin' || req.user.role === 'college') {
                user.verificationData = verificationData;
                user.verified = true;
                await user.save();
                return res.json({ message: 'User manually verified by admin', success: true });
            }
            return res.status(403).json({ message: 'Manual verification required by admin', error: true });
        }
    } catch (error) {
        res.status(500).json({ message: error.message, error: true });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json({ products, success: true });
    } catch (error) {
        res.status(500).json({ message: error.message, error: true });
    }
});

app.post('/api/products', authenticate, checkRole(['admin', 'college']), async (req, res) => {
    const product = new Product(req.body);
    try {
        await product.save();
        res.status(201).json({ product, success: true });
    } catch (error) {
        res.status(400).json({ message: error.message, error: true });
    }
});

app.put('/api/products/:id', authenticate, checkRole(['admin', 'college']), async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found', error: true });
        }
        res.json({ product, success: true });
    } catch (error) {
        res.status(400).json({ message: error.message, error: true });
    }
});

app.delete('/api/products/:id', authenticate, checkRole(['admin', 'college']), async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found', error: true });
        }
        res.json({ product, success: true });
    } catch (error) {
        res.status(500).json({ message: error.message, error: true });
    }
});

app.get('/api/colleges', async (req, res) => {
    const { search } = req.query;
    try {
        const query = search ? { $or: [{ name: { $regex: search, $options: 'i' } }, { shortCode: { $regex: search, $options: 'i' } }] } : {};
        const colleges = await College.find(query);
        res.json({ colleges, success: true });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message, error: true });
    }
});

app.post('/api/colleges', authenticate, checkRole(['admin', 'college']), async (req, res) => {
    const college = new College(req.body);
    try {
        await college.save();
        res.status(201).json({ college, success: true });
    } catch (error) {
        res.status(400).json({ message: error.message, error: true });
    }
});

app.put('/api/colleges/:id', authenticate, checkRole(['admin', 'college']), async (req, res) => {
    try {
        const college = await College.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!college) {
            return res.status(404).json({ message: 'College not found', error: true });
        }
        res.json({ college, success: true });
    } catch (error) {
        res.status(400).json({ message: error.message, error: true });
    }
});

app.delete('/api/colleges/:id', authenticate, checkRole(['admin', 'college']), async (req, res) => {
    try {
        const college = await College.findByIdAndDelete(req.params.id);
        if (!college) {
            return res.status(404).json({ message: 'College not found', error: true });
        }
        res.json({ college, success: true });
    } catch (error) {
        res.status(500).json({ message: error.message, error: true });
    }
});

app.post('/api/test', async (req, res) => {
    const { email } = req.body;
    try {
        await sendCustomEmail(email);
        res.json({ message: 'Custom email sent successfully', success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message, error: true });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email, registerOtp: otp });
        if (!user) {
            return res.status(400).json({ message: 'Invalid OTP or No User', error: true });
        }
        const college = await College.findOne({ shortCode: user.college });
        const emailDomain = user.email.split('@')[1];
        let idCard = false;
        if (college.emailExtensions.includes(emailDomain)) {
            user.verified = true;
        } else {
            idCard = true;
            user.verified = false;
        }
        user.registerOtp = null;
        user.lastOtp = null;
        await user.save();
        res.json({ message: 'Email verified successfully', success: true, idCard });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message, error: true });
    }
});

app.post('/api/upload-id', async (req, res) => {
    const { email, college, idCardUrl } = req.body;
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found', error: true });
        }

        user.college = college;
        user.verificationData.idCard = idCardUrl;
        user.verified = false;

        await user.save();
        res.json({ message: 'ID card URL updated successfully. Please wait for manual verification.', success: true });
    } catch (error) {
        res.status(500).json({ message: error.message, error: true });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


module.exports = (req, res) => {
    app(req, res);
};
