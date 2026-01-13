import { useState } from "react";
import { auth, db } from "./firebase";
import { Users, Mail, Lock, User, ArrowRight, ShieldCheck, Phone } from "lucide-react";
import './App.css';

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

function Login({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        name: "",
        phoneNumber: "",
    });

    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("error"); // 'error' or 'success'
    const [otpCode, setOtpCode] = useState("");
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const setupRecaptcha = () => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => {
                    // reCAPTCHA solved
                }
            });
        }
    };

    const handleSendOtp = async () => {
        if (!formData.phoneNumber) {
            setMessage("Please enter phone number first.");
            setMessageType("error");
            return;
        }

        // Firebase Phone Auth requires E.164 format (starts with +)
        if (!formData.phoneNumber.startsWith('+')) {
            setMessage("Phone number must start with '+' and include country code (e.g., +91...)");
            setMessageType("error");
            return;
        }

        setIsVerifying(true);
        setMessage("Initializing verification...");

        try {
            console.log("📱 Attempting to send OTP to:", formData.phoneNumber);
            setupRecaptcha();
            const appVerifier = window.recaptchaVerifier;
            const confirmation = await signInWithPhoneNumber(auth, formData.phoneNumber, appVerifier);
            setConfirmationResult(confirmation);
            setIsOtpSent(true);
            setMessageType("success");
            setMessage("Verification code sent to your phone.");
            console.log("✅ OTP Sent successfully!");
        } catch (error) {
            console.error("❌ OTP Send Error:", error);
            setMessageType("error");

            // Provide more specific error messages
            if (error.code === 'auth/invalid-phone-number') {
                setMessage("The phone number is invalid. Use E.164 format (+123456789).");
            } else if (error.code === 'auth/captcha-check-failed') {
                setMessage("Recaptcha verification failed. Please try again.");
            } else if (error.code === 'auth/too-many-requests') {
                setMessage("Too many attempts. Please try again later.");
            } else {
                setMessage(`Failed to send OTP: ${error.message}`);
            }

            // Reset recaptcha on error so it can be used again
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                    window.recaptchaVerifier = null;
                } catch (e) { }
            }
        } finally {
            setIsVerifying(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otpCode) return;
        setIsVerifying(true);
        try {
            await confirmationResult.confirm(otpCode);
            setIsPhoneVerified(true);
            setIsOtpSent(false);
            setMessageType("success");
            setMessage("Phone number verified successfully!");
        } catch (error) {
            console.error(error);
            setMessageType("error");
            setMessage("Invalid verification code. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSubmit = async () => {
        setMessage("");
        try {
            if (isLogin) {
                const userCredential = await signInWithEmailAndPassword(
                    auth,
                    formData.email,
                    formData.password
                );
                onLogin({
                    id: userCredential.user.uid,
                    username: userCredential.user.displayName || userCredential.user.email,
                });
            } else {
                if (formData.password !== formData.confirmPassword) {
                    setMessageType("error");
                    setMessage("Passwords do not match");
                    return;
                }
                if (!isPhoneVerified) {
                    setMessageType("error");
                    setMessage("Please verify your phone number first.");
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    formData.email,
                    formData.password
                );
                await updateProfile(userCredential.user, {
                    displayName: formData.name,
                });

                // Store user details in Firestore
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    name: formData.name,
                    email: formData.email,
                    phoneNumber: formData.phoneNumber,
                    createdAt: new Date().toISOString(),
                });

                // Sync with Django Backend
                try {
                    await fetch('http://localhost:8000/api/auth/register/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: formData.name,
                            email: formData.email,
                            password: formData.password,
                            phone_number: formData.phoneNumber
                        })
                    });
                } catch (backendError) {
                    console.error("Backend sync failed:", backendError);
                }

                onLogin({
                    id: userCredential.user.uid,
                    username: formData.name,
                });
            }
        } catch (error) {
            console.error(error);
            setMessageType("error");
            if (isLogin) {
                setMessage("Invalid email or password.");
            } else {
                // Show the actual error message for debugging
                setMessage(`Signup failed: ${error.message}`);
            }
        }
    };

    const handleForgotPassword = async () => {
        setMessage("");
        if (!formData.email) {
            setMessageType("error");
            setMessage("Please enter your email address.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, formData.email);
            setMessageType("success");
            setMessage("A password reset link has been sent to your email.");
        } catch (error) {
            console.error(error);
            setMessageType("error");
            setMessage("Failed to send reset email. Please try again.");
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setIsForgotPassword(false);
        setMessage("");
        setFormData({ email: "", password: "", confirmPassword: "", name: "", phoneNumber: "" });
    };

    const toggleForgotPassword = () => {
        setIsForgotPassword(!isForgotPassword);
        setMessage("");
        setFormData({ ...formData, password: "", confirmPassword: "", name: "", phoneNumber: "" });
    };

    return (
        <div className="global-bg-gradient min-h-screen flex items-center justify-center p-6 font-sans">
            <div className="card-glass rounded-[40px] shadow-2xl p-10 w-full max-w-lg relative overflow-hidden border border-white/10">
                {/* Decorative Elements */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl shadow-xl mb-6 transform hover:rotate-12 transition-transform duration-500">
                            <ShieldCheck className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">SafeChat</h1>
                        <p className="text-purple-200/60 font-bold uppercase tracking-[0.2em] text-xs">Secure Communication System</p>
                    </div>

                    <div className="space-y-6">
                        {isForgotPassword ? (
                            <div className="animate-fade-in space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-purple-300 uppercase tracking-widest mb-2 ml-1">Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/40 group-focus-within:text-purple-400 transition-colors" />
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                                            placeholder="Email"
                                        />
                                    </div>
                                </div>

                                {message && (
                                    <div className={`p-4 rounded-xl text-xs font-bold text-center ${messageType === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                                        {message}
                                    </div>
                                )}

                                <button
                                    onClick={handleForgotPassword}
                                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:from-purple-700 hover:to-blue-700 transition-all shadow-xl group"
                                >
                                    <span className="flex items-center justify-center">
                                        Request Link <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </button>

                                <button onClick={toggleForgotPassword} className="w-full text-purple-300/60 text-xs font-black uppercase tracking-widest hover:text-white transition-colors">
                                    Return to Login
                                </button>
                            </div>
                        ) : (
                            <div className="animate-fade-in space-y-6">
                                {!isLogin && (
                                    <div>
                                        <label className="block text-[10px] font-black text-purple-300 uppercase tracking-widest mb-2 ml-1">Name</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/40 group-focus-within:text-purple-400 transition-colors" />
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                                                placeholder="Name"
                                            />
                                        </div>
                                    </div>
                                )}

                                {!isLogin && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-purple-300 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                                            <div className="relative group flex gap-2">
                                                <div className="relative flex-1">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/40 group-focus-within:text-purple-400 transition-colors" />
                                                    <input
                                                        type="tel"
                                                        name="phoneNumber"
                                                        value={formData.phoneNumber}
                                                        onChange={handleChange}
                                                        disabled={isPhoneVerified}
                                                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none disabled:opacity-50"
                                                        placeholder="Phone Number (e.g. +1234567890)"
                                                    />
                                                </div>
                                                {!isPhoneVerified && !isOtpSent && (
                                                    <button
                                                        onClick={handleSendOtp}
                                                        disabled={isVerifying}
                                                        className="px-4 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-600/40 transition-all disabled:opacity-50"
                                                    >
                                                        Verify
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {isOtpSent && !isPhoneVerified && (
                                            <div className="animate-fade-in space-y-4">
                                                <label className="block text-[10px] font-black text-purple-300 uppercase tracking-widest mb-2 ml-1">Verification Code</label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/40 group-focus-within:text-purple-400 transition-colors" />
                                                        <input
                                                            type="text"
                                                            value={otpCode}
                                                            onChange={(e) => setOtpCode(e.target.value)}
                                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                                                            placeholder="6-digit code"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleVerifyOtp}
                                                        disabled={isVerifying}
                                                        className="px-4 bg-green-600/20 border border-green-500/30 text-green-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600/40 transition-all disabled:opacity-50"
                                                    >
                                                        Confirm
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div id="recaptcha-container"></div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-black text-purple-300 uppercase tracking-widest mb-2 ml-1">Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/40 group-focus-within:text-purple-400 transition-colors" />
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                                            placeholder="Email"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-purple-300 uppercase tracking-widest mb-2 ml-1">Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/40 group-focus-within:text-purple-400 transition-colors" />
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                                            placeholder="Password"
                                        />
                                    </div>
                                </div>

                                {!isLogin && (
                                    <div>
                                        <label className="block text-[10px] font-black text-purple-300 uppercase tracking-widest mb-2 ml-1">Re-verify Key</label>
                                        <div className="relative group">
                                            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/40 group-focus-within:text-purple-400 transition-colors" />
                                            <input
                                                type="password"
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                                                placeholder="Confirm security key"
                                            />
                                        </div>
                                    </div>
                                )}

                                {message && (
                                    <div className="p-4 rounded-xl text-xs font-bold text-center bg-red-500/10 text-red-400 border border-red-500/20">
                                        {message}
                                    </div>
                                )}

                                <button
                                    onClick={handleSubmit}
                                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:from-purple-700 hover:to-blue-700 transition-all shadow-[0_10px_30px_rgba(138,43,226,0.3)] group"
                                >
                                    <span className="flex items-center justify-center">
                                        {isLogin ? "Login" : "Sign Up"}
                                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>

                    {!isForgotPassword && (
                        <div className="mt-10 text-center space-y-4">
                            {isLogin && (
                                <button
                                    onClick={toggleForgotPassword}
                                    className="text-purple-300/40 text-xs font-bold hover:text-white transition-colors uppercase tracking-[0.1em]"
                                >
                                    Lost Security Key?
                                </button>
                            )}
                            <div className="h-px bg-white/5 w-full mx-auto"></div>
                            <p className="text-purple-200/40 text-xs font-medium">
                                {isLogin ? "New user? " : "Existing operator? "}
                                <button
                                    onClick={toggleMode}
                                    className="text-purple-400 font-black hover:text-purple-300 transition-colors uppercase tracking-widest ml-1"
                                >
                                    {isLogin ? "Sign Up" : "Login"}
                                </button>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Login;

