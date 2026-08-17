import Link from "next/link";
import {Lock} from "lucide-react";
import {EnvVarWarning} from "@/components/env-var-warning";
import {AuthButton} from "@/components/auth-button";
import {Hero} from "@/components/hero";
import {ThemeSwitcher} from "@/components/theme-switcher";
import {hasEnvVars} from "@/lib/utils";
import {Suspense} from "react";
import {SpeechRecognitionCycle} from "@/components/speech-recognition";
import {createClient} from "@/lib/supabase/server";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";

async function AuthNav() {
    if (!hasEnvVars) {
        return (
            <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <EnvVarWarning/>
            </nav>
        );
    }

    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    return (
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
            <AuthButton/>
        </nav>
    );
}

async function VoiceWidget() {
    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();

    if (user) {
        return <SpeechRecognitionCycle/>;
    }

    return (
        <Card className="h-[640px] w-[560px] shrink-0">
            <CardContent className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Lock className="h-6 w-6 text-muted-foreground"/>
                </div>
                <div className="flex flex-col gap-2">
                    <p className="text-lg font-medium">Sign in to talk to Sarjy</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                        Create an account or sign in to start a voice conversation.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/auth/login">Sign in</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/auth/sign-up">Sign up</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function Home() {
    return (
        <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-20 items-center">
                <Suspense>
                    <AuthNav/>
                </Suspense>
                <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5">
                    <Hero/>
                    <Suspense fallback={<Card className="h-[640px] w-[560px] shrink-0"/>}>
                        <VoiceWidget/>
                    </Suspense>
                </div>

                <footer
                    className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
                    <ThemeSwitcher/>
                </footer>
            </div>
        </main>
    );
}
