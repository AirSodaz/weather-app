/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            animation: {
                'spin-slow': 'spin-slow 8s linear infinite',
                'fade-in': 'fade-in 0.3s ease-out forwards',
                'slide-up': 'slide-up 0.4s ease-out forwards',
                'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
                'float': 'float 3s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}
