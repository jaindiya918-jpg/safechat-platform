import { useState } from "react";
import { auth } from "./firebase";
import { Users } from "lucide-react";

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail
} from "firebase/auth";


function Login({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        name: "",
    });
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("error"); // 'error' or 'success'

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
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

                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    formData.email,
                    formData.password
                );

                await updateProfile(userCredential.user, {
                    displayName: formData.name,
                });

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
                setMessage("Signup failed. Please try again.");
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
            setMessage("A password reset link has been sent to your email. Please check your inbox or spam folder.");
        } catch (error) {
            console.error(error);
            setMessageType("error");

            if (error.code === "auth/user-not-found") {
                setMessage("No account found with this email.");
            } else if (error.code === "auth/invalid-email") {
                setMessage("Invalid email address.");
            } else {
                setMessage("Failed to send reset email. Please try again.");
            }
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setIsForgotPassword(false);
        setMessage("");
        setFormData({
            email: "",
            password: "",
            confirmPassword: "",
            name: "",
        });
    };

    const toggleForgotPassword = () => {
        setIsForgotPassword(!isForgotPassword);
        setMessage("");
        setFormData({
            email: formData.email,
            password: "",
            confirmPassword: "",
            name: "",
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-block p-3 bg-purple-100 rounded-full mb-4">
                        <Users className="w-12 h-12 text-purple-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">SafeChat</h1>
                    <p className="text-gray-600">AI-Powered Real-Time Social Platform</p>
                </div>

                <div className="space-y-4">
                    {isForgotPassword ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border rounded-lg"
                                    placeholder="Enter your email"
                                />
                            </div>

                            {message && (
                                <div className={`text-sm ${messageType === "success" ? "text-green-600" : "text-red-600"}`}>
                                    {message}
                                </div>
                            )}

                            <button
                                onClick={handleForgotPassword}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
                            >
                                Send Reset Email
                            </button>

                            <button
                                onClick={toggleForgotPassword}
                                className="w-full text-blue-600 font-semibold hover:underline"
                            >
                                Back to Login
                            </button>
                        </>
                    ) : (
                        <>
                            {!isLogin && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border rounded-lg"
                                        placeholder="Enter your name"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border rounded-lg"
                                    placeholder="Enter your email"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border rounded-lg"
                                    placeholder="Enter your password"
                                />
                            </div>

                            {!isLogin && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border rounded-lg"
                                        placeholder="Confirm password"
                                    />
                                </div>
                            )}

                            {message && (
                                <div className={`text-sm ${messageType === "success" ? "text-green-600" : "text-red-600"}`}>
                                    {message}
                                </div>
                            )}

                            <button
                                onClick={handleSubmit}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
                            >
                                {isLogin ? "Login" : "Sign Up"}
                            </button>
                        </>
                    )}
                </div>

                {!isForgotPassword && (
                    <div className="mt-6 text-center space-y-2">
                        {isLogin && (
                            <button
                                onClick={toggleForgotPassword}
                                className="text-blue-600 text-sm hover:underline block w-full"
                            >
                                Forgot Password?
                            </button>
                        )}
                        <p className="text-gray-600">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <button
                                onClick={toggleMode}
                                className="text-blue-600 font-semibold hover:underline"
                            >
                                {isLogin ? "Sign Up" : "Login"}
                            </button>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Login;