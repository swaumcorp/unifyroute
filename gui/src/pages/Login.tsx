import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin } from "@/lib/api";

export function Login() {
    const [apiKey, setApiKey] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        // Ensure either apiKey or password is provided
        const credentials = apiKey || password;
        if (!credentials) {
            setError("Please enter your API Key or admin password");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await adminLogin(credentials);
            // In a real implementation we'd probably try to hit a /me or /verify endpoint here,
            // but for now we'll assume adminLogin stores the token and we can redirect.
            navigate("/wizard");
        } catch (err: any) {
            setError(err.message || "Invalid credentials. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
            <div className="w-full max-w-sm space-y-8">
                {/* Logo & Headline */}
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-center mb-6">
                        <img src="/images/favicon.png" alt="UnifyRoute Logo" className="w-10 h-10 object-contain" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                        <span className="text-orange-600">Unify</span>Route Gateway
                    </h2>
                    <p className="text-sm text-slate-500 mt-2 font-medium tracking-wide uppercase">Admin Login</p>
                </div>

                {/* Login Form Card */}
                <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="apiKey" className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                Master Password or Admin Key
                            </Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Key className="h-4 w-4 text-slate-400" />
                                </div>
                                <Input
                                    id="apiKey"
                                    type="password"
                                    placeholder="Enter your key or password"
                                    autoComplete="current-password"
                                    className="pl-10 h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-orange-500"
                                    value={apiKey || password}
                                    onChange={(e) => {
                                        setApiKey(e.target.value);
                                        setPassword(e.target.value);
                                    }}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-colors shadow-none"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Authenticating...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </form>
                </div>

                <div className="text-center">
                    <p className="text-xs text-slate-400 font-medium tracking-wide">
                        Secure Access &copy; {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    );
}
