
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    const year = new Date().getFullYear()
    return (
        <div className="relative h-full">
            <div className="h-full">{children}</div>
        </div>
    )
}