/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{html,js,svelte,ts}'],
    theme: {
        extend: {
            colors: {
                // app.css의 CSS 변수를 여기에 등록합니다.
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                muted: 'hsl(var(--muted))',
                'muted-foreground': 'hsl(var(--muted-foreground))',
                border: 'hsl(var(--border))',
                accent: 'hsl(var(--accent))',
                'accent-foreground': 'hsl(var(--accent-foreground))',
                // ... 필요한 다른 색상들도 추가
            },
            borderRadius: {
                lg: `var(--radius-card-lg)`,
                md: `var(--radius-card)`,
                sm: `var(--radius-card-sm)`,
            }
        },
    },
    plugins: [
        require('@tailwindcss/typography'), // 마크다운 스타일링을 위한 플러그인
    ],
};