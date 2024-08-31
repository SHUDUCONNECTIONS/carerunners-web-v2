import React from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Home,
  MessageSquare,
  Truck,
  FileText,
  User,
  LogOut,
  Package,
  Upload,
  Briefcase,
  CreditCard,
  Users,
  Search,
  Menu,
} from "lucide-react"
import Link from "../../../../node_modules/next/link"

export default function Dashboard() {
  const menuItems = [
    { icon: <Home className="mr-2 h-4 w-4" />, label: "HOME" },
    { icon: <MessageSquare className="mr-2 h-4 w-4" />, label: "CONSULTATION" },
    { icon: <Truck className="mr-2 h-4 w-4" />, label: "REQUEST PICK-UP" },
    { icon: <FileText className="mr-2 h-4 w-4" />, label: "T&C's" },
    { icon: <User className="mr-2 h-4 w-4" />, label: "PROFILE" },
    { icon: <LogOut className="mr-2 h-4 w-4" />, label: "SIGN OUT" },
  ]

  const dashboardItems = [
    { icon: <Package className="h-8 w-8" />, label: "Request Pickup", link:'/request' },
    { icon: <Upload className="h-8 w-8" />, label: "Upload Case File",link:'/upload'  },
    { icon: <Briefcase className="h-8 w-8" />, label: "Firm Records",link:'/records'  },
    { icon: <User className="h-8 w-8" />, label: "Account Profile" ,link:'/profile' },
    { icon: <Users className="h-8 w-8" />, label: "Membership Access",link:'/request'  },
    { icon: <CreditCard className="h-8 w-8" />, label: "Billing Information",link:'/trips'  },
  ]

  return (
    <div >

      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10 bg-white w-full"
              placeholder="Search..."
              type="search"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardItems.map((item, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-300 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-teal-700">{item.label}</CardTitle>
                <div className="text-teal-600">{item.icon}</div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600">
                  Access and manage your {item.label.toLowerCase()}.
                </CardDescription>
                <Link href={`${item.link}`}>
                <Button className="mt-4 w-full bg-teal-600 hover:bg-teal-700 text-white">
                  View Details
                </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

    </div>
  )
}