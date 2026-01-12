import React, { useState } from 'react';
import { User, FileText, Camera, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

const Onboarding = ({ user, onComplete }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        nickname: user.username || '',
        bio: '',
        avatar: null
    });
    const [loading, setLoading] = useState(false);

    const handleNext = () => {
        if (step < 4) setStep(step + 1);
        else handleSubmit();
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8000/api/auth/onboard/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                const updatedUser = await response.json();
                onComplete(updatedUser);
            } else {
                alert('Onboarding failed. Please try again.');
            }
        } catch (error) {
            console.error('Onboarding error:', error);
            alert('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="animate-fade-in space-y-6">
                        <div className="text-center">
                            <div className="inline-flex p-4 bg-purple-500/20 rounded-2xl mb-4">
                                <User className="w-8 h-8 text-purple-400" />
                            </div>
                            <h2 className="text-2xl font-black text-white">Choose your identity</h2>
                            <p className="text-purple-200/40 text-sm mt-2">What should we call you in the sanctuary?</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-300 uppercase tracking-widest ml-1">Nickname</label>
                            <input
                                type="text"
                                value={formData.nickname}
                                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                placeholder="E.g. Digital Ghost"
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="animate-fade-in space-y-6">
                        <div className="text-center">
                            <div className="inline-flex p-4 bg-blue-500/20 rounded-2xl mb-4">
                                <FileText className="w-8 h-8 text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-black text-white">Tell your story</h2>
                            <p className="text-purple-200/40 text-sm mt-2">A short bio helps others know you better.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-300 uppercase tracking-widest ml-1">Bio</label>
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all h-32 resize-none"
                                placeholder="Software alchemist and tea enthusiast..."
                            />
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="animate-fade-in space-y-6">
                        <div className="text-center">
                            <div className="inline-flex p-4 bg-pink-500/20 rounded-2xl mb-4">
                                <Camera className="w-8 h-8 text-pink-400" />
                            </div>
                            <h2 className="text-2xl font-black text-white">Visual Presence</h2>
                            <p className="text-purple-200/40 text-sm mt-2">Your avatar is your face in the digital world.</p>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-4xl font-black text-white shadow-2xl mb-6">
                                {formData.nickname.charAt(0).toUpperCase()}
                            </div>
                            <button className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-white uppercase tracking-widest hover:bg-white/10 transition-all flex items-center space-x-2">
                                <Camera className="w-4 h-4" />
                                <span>Upload Photo</span>
                            </button>
                            <p className="text-[10px] text-purple-200/20 mt-4 uppercase font-bold tracking-tighter">Photos are moderated for safety</p>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="animate-fade-in space-y-6">
                        <div className="text-center">
                            <div className="inline-flex p-4 bg-green-500/20 rounded-2xl mb-4">
                                <ShieldCheck className="w-8 h-8 text-green-400" />
                            </div>
                            <h2 className="text-2xl font-black text-white">The Guardian Code</h2>
                            <p className="text-purple-200/40 text-sm mt-2">SafeChat is built on respect and integrity.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <h4 className="text-xs font-black text-purple-300 uppercase mb-1">Karma System</h4>
                                <p className="text-xs text-white/60">Your behavior affects your visibility. Kind users earn rewards; toxic actors are restricted.</p>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                <h4 className="text-xs font-black text-purple-300 uppercase mb-1">Humanity Score</h4>
                                <p className="text-xs text-white/60">We use AI to ensure conversations stay constructive and safe for everyone.</p>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
            <div className="card-glass max-w-lg w-full rounded-[40px] p-10 border border-white/10 relative overflow-hidden">
                {/* Decorative */}
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex space-x-2">
                            {[1, 2, 3, 4].map((s) => (
                                <div
                                    key={s}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${s === step ? 'w-8 bg-purple-500' : 'w-3 bg-white/10'
                                        }`}
                                ></div>
                            ))}
                        </div>
                        <span className="text-[10px] font-black text-purple-300 uppercase tracking-[0.2em]">Step {step}/4</span>
                    </div>

                    <div className="min-h-[300px]">
                        {renderStep()}
                    </div>

                    <div className="mt-10 flex gap-4">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="flex-1 py-4 border border-white/10 rounded-2xl text-xs font-black text-white uppercase tracking-widest hover:bg-white/5 transition-all"
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            disabled={loading}
                            className="flex-[2] bg-gradient-to-r from-purple-600 to-blue-600 py-4 rounded-2xl text-xs font-black text-white uppercase tracking-[0.2em] shadow-xl hover:shadow-purple-500/20 transition-all flex items-center justify-center group"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span>{step === 4 ? 'Complete Journey' : 'Continue'}</span>
                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
