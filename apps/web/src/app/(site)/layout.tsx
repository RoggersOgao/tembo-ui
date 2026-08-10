import Footer from "@/components/layout/footer"
import { Nav } from "@/components/layout/menu"

export default function SiteLayout({ children }: { children: React.ReactNode }) {
    const year = new Date().getFullYear()
    return (
        <div className="relative h-full">
            <div className="w-full bg-amber-500 relative z-50 ">
                <Nav />
            </div>
            <div className="h-full">{children}</div>
            <div>
                <Footer />
            </div>
        </div>
    )
}