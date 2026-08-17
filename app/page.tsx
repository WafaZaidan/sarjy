import {EnvVarWarning} from "@/components/env-var-warning";
import {AuthButton} from "@/components/auth-button";
import {Hero} from "@/components/hero";
import {ThemeSwitcher} from "@/components/theme-switcher";
import {hasEnvVars} from "@/lib/utils";
import {Suspense} from "react";
import {SpeechRecognitionCycle} from "@/components/speech-recognition";

export default function Home() {
    return (
        <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-20 items-center">
                <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                    {!hasEnvVars ? (
                        <EnvVarWarning/>
                    ) : (
                        <Suspense>
                            <AuthButton/>
                        </Suspense>
                    )}
                </nav>
                <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5">
                    <Hero/>
                    <SpeechRecognitionCycle/>
                </div>

                <footer
                    className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
                    <ThemeSwitcher/>
                </footer>
            </div>
        </main>
    );
}
