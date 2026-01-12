import React, { useState, useEffect } from 'react';
import {
    User, Heart, MessageSquare, Shield, AlertTriangle,
    TrendingUp, Ban, Grid, Bookmark, Tag, MapPin,
    Calendar, Edit3, Settings, ShieldCheck, HeartPulse, Sparkles
} from 'lucide-react';

const Profile = ({ currentUser }) => {
    const [userData, setUserData] = useState(currentUser);
    const [activeTab, setActiveTab] = useState('posts');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/auth/profile/${currentUser.username}/`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    setUserData(data);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [currentUser.username]);

    const getKarmaLabel = (score) => {
        if (score < 0.2) return { label: 'Paragon', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' };
        if (score < 0.5) return { label: 'Neutral', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
        return { label: 'Watched', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    };

    const karma = getKarmaLabel(userData?.toxicity_score || 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-8 max-w-4xl mx-auto pb-20">
            {/* Profile Header */}
            <div className="card-glass rounded-[40px] p-10 border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 flex space-x-2">
                    <button className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10">
                        <Edit3 className="w-4 h-4 text-purple-200" />
                    </button>
                    <button className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10">
                        <Settings className="w-4 h-4 text-purple-200" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
                    <div className="relative">
                        <div className="w-40 h-40 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 p-1 shadow-2xl">
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                                {userData?.avatar ? (
                                    <img src={userData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-5xl font-black text-white">{userData.username.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                        </div>
                        <div className={`absolute bottom-2 right-2 p-2 rounded-full border-4 border-slate-900 shadow-xl ${karma.bg} ${karma.border}`}>
                            <ShieldCheck className={`w-5 h-5 ${karma.color}`} />
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                            <h1 className="text-3xl font-black text-white tracking-tighter">{userData.nickname || userData.username}</h1>
                            <div className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${karma.border} ${karma.bg} ${karma.color}`}>
                                {karma.label} Resident
                            </div>
                        </div>

                        <div className="flex justify-center md:justify-start gap-8 mb-6">
                            <div className="text-center">
                                <p className="text-xl font-black text-white">0</p>
                                <p className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest">Posts</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-black text-white">{userData.followers_count || 0}</p>
                                <p className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest">Followers</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-black text-white">{userData.following_count || 0}</p>
                                <p className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest">Following</p>
                            </div>
                        </div>

                        <p className="text-purple-100/60 text-sm leading-relaxed max-w-md">
                            {userData.bio || "No bio yet. Tell the world who you are."}
                        </p>

                        <div className="flex items-center justify-center md:justify-start gap-4 mt-6 text-[10px] font-bold text-purple-300/40 uppercase tracking-widest">
                            <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> Metaverse</span>
                            <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                Joined {new Date(userData.date_joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Safety Scorecard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 card-glass rounded-[40px] p-8 border border-white/10 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-white tracking-tight flex items-center">
                                <Shield className="w-5 h-5 mr-2 text-purple-400" />
                                Safety Scorecard
                            </h3>
                            <p className="text-xs text-purple-200/40 font-bold uppercase tracking-widest mt-1">Behavioral Integrity Report</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-white">{(1 - (userData?.toxicity_score || 0)) * 100}%</div>
                            <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Humanity Score</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                    <span className="text-purple-200/40">Toxicity Exposure</span>
                                    <span className="text-white">{(userData?.toxicity_score || 0).toFixed(2)}</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-1000"
                                        style={{ width: `${(userData?.toxicity_score || 0) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                    <span className="text-purple-200/40">Message Integrity</span>
                                    <span className="text-white">
                                        {userData?.messages_sent ? (((userData.messages_sent - userData.messages_blocked) / userData.messages_sent) * 100).toFixed(0) : 100}%
                                    </span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-500 transition-all duration-1000"
                                        style={{ width: `${userData?.messages_sent ? ((userData.messages_sent - userData.messages_blocked) / userData.messages_sent) * 100 : 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
                                <div className="text-xl font-black text-white">{userData.messages_blocked || 0}</div>
                                <div className="text-[9px] font-bold text-red-400/60 uppercase tracking-tighter">Violations</div>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
                                <div className="text-xl font-black text-white">{userData.fake_news_count || 0}</div>
                                <div className="text-[9px] font-bold text-orange-400/60 uppercase tracking-tighter">Misinfo</div>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
                                <div className="text-xl font-black text-white">{userData.reports_received || 0}</div>
                                <div className="text-[9px] font-bold text-purple-400/60 uppercase tracking-tighter">Reports</div>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
                                <div className="text-xl font-black text-white">{userData.messages_sent || 0}</div>
                                <div className="text-[9px] font-bold text-green-400/60 uppercase tracking-tighter">Sent</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card-glass rounded-[40px] p-8 border border-white/10 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-2">
                        <HeartPulse className="w-8 h-8 text-pink-400" />
                    </div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Guardian Rank</h4>
                    <p className="text-[10px] text-purple-200/40 font-bold uppercase leading-tight">Your positive impact on the community</p>
                    <div className="text-xs font-black text-purple-300">#422 Globally</div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="space-y-6">
                <div className="flex justify-center border-b border-white/5">
                    <div className="flex space-x-12">
                        <button
                            onClick={() => setActiveTab('posts')}
                            className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center space-x-2 ${activeTab === 'posts' ? 'text-white border-b-2 border-purple-500' : 'text-purple-100/30 hover:text-white'}`}
                        >
                            <Grid className="w-4 h-4" />
                            <span>Posts</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('saved')}
                            className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center space-x-2 ${activeTab === 'saved' ? 'text-white border-b-2 border-purple-500' : 'text-purple-100/30 hover:text-white'}`}
                        >
                            <Bookmark className="w-4 h-4" />
                            <span>Saved</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('tagged')}
                            className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center space-x-2 ${activeTab === 'tagged' ? 'text-white border-b-2 border-purple-500' : 'text-purple-100/30 hover:text-white'}`}
                        >
                            <Tag className="w-4 h-4" />
                            <span>Tagged</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {/* Empty State */}
                    <div className="col-span-3 py-20 text-center space-y-4">
                        <div className="inline-flex p-6 bg-white/5 rounded-full border border-white/10">
                            <Sparkles className="w-10 h-10 text-purple-500/40" />
                        </div>
                        <h3 className="text-xl font-black text-white/40">No posts yet</h3>
                        <p className="text-xs text-purple-200/20 uppercase font-bold tracking-widest">Start your journey by sharing a moment</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
