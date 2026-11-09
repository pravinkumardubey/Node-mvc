const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendEmail = async (req, res) => {
	console.log("EMAIL_USER:", process.env.EMAIL_USER);
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS);
    try {
        const info = await transporter.sendMail({
            from: `"Pravin" <${process.env.EMAIL_USER}>`,
            to: "pravin.kumar@indianic.com",
            subject: "Welcome Pravin",
            text: "Hello from Node.js",
            html: `<h2>Hello This is test message from Node js</h2>
            <img src='https://lh3.googleusercontent.com/a-/ALV-UjVN5eW79XxWzfqLGvTlsa9BJWh93yVNeiap0yxkMrcO2P-6EUlm=s40-p'>`,
            attachments: [
		        {
		            filename: "image.jpg",
		            path: "https://lh3.googleusercontent.com/a-/ALV-UjVN5eW79XxWzfqLGvTlsa9BJWh93yVNeiap0yxkMrcO2P-6EUlm=s40-p",
		        }
		    ],
        });

        console.log("Email sent:", info.messageId);

        return res.status(200).json({
            success: true,
            message: "Email sent successfully",
            messageId: info.messageId,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    sendEmail,
};