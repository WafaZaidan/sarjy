import {Laptop, Mic, MessageCircle, Music} from "lucide-react";
import type {ComponentType, CSSProperties} from "react";

type Shape = {
    Icon: ComponentType<{className?: string; style?: CSSProperties}>;
    top: string;
    left: string;
    size: number;
    rotate: number;
    color: string;
};

const SHAPES: Shape[] = [
    {Icon: Mic, top: "8%", left: "6%", size: 48, rotate: -12, color: "text-pink-300 dark:text-pink-400/50"},
    {Icon: Music, top: "18%", left: "88%", size: 40, rotate: 15, color: "text-blue-300 dark:text-blue-400/50"},
    {Icon: MessageCircle, top: "72%", left: "4%", size: 56, rotate: 8, color: "text-blue-300 dark:text-blue-400/50"},
    {Icon: Laptop, top: "80%", left: "85%", size: 52, rotate: -6, color: "text-pink-300 dark:text-pink-400/50"},
    {Icon: Music, top: "45%", left: "92%", size: 32, rotate: -20, color: "text-pink-200 dark:text-pink-400/40"},
    {Icon: Mic, top: "60%", left: "50%", size: 28, rotate: 25, color: "text-blue-200 dark:text-blue-400/40"},
    {Icon: MessageCircle, top: "10%", left: "45%", size: 30, rotate: -15, color: "text-pink-200 dark:text-pink-400/40"},
    {Icon: Laptop, top: "30%", left: "15%", size: 30, rotate: 10, color: "text-blue-200 dark:text-blue-400/40"},
];

export function DecorativeBackground() {
    return (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
            {SHAPES.map(({Icon, top, left, size, rotate, color}, i) => (
                <Icon
                    key={i}
                    className={`absolute ${color}`}
                    style={{top, left, width: size, height: size, transform: `rotate(${rotate}deg)`}}
                />
            ))}
        </div>
    );
}
