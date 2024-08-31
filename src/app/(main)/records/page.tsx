"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileText, MoreVertical, Download, Trash, Eye } from "lucide-react"
import { db, auth } from "@/utils/firebase"
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { useRouter } from "next/navigation"
import LoadingComponent from "@/components/loader"

type Document = {
  id: string
  fileName: string
  fileType: string
  uploadedAt: string
  fileUrl: string
  description: string
  firmId: string
}

export default function LawyerDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(auth.currentUser)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user) {
        setDocuments([])
        return
      }

      try {
        setLoading(true)
        const firmsCollection = collection(db, "firms")
        const userFirmsQuery = query(firmsCollection, where("adminId", "==", user.uid))
        const firmsSnapshot = await getDocs(userFirmsQuery)

        const allDocuments: Document[] = []

        for (const firmDoc of firmsSnapshot.docs) {
          const documentsCollection = collection(db, "firms", firmDoc.id, "documents")
          const documentsSnapshot = await getDocs(documentsCollection)

          documentsSnapshot.forEach((doc) => {
            const data = doc.data()
            allDocuments.push({
              id: doc.id,
              fileName: data.fileName,
              fileType: data.fileType,
              uploadedAt: data.uploadedAt.toDate().toLocaleDateString(),
              fileUrl: data.fileUrl,
              description: data.description,
              firmId: firmDoc.id
            })
          })
        }

        setDocuments(allDocuments)
      } catch (error) {
        console.error("Error fetching documents:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [user])

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value)
  }

  const filteredDocuments = documents.filter(doc =>
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.fileType.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDelete = async (id: string, firmId: string) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      try {
        await deleteDoc(doc(db, "firms", firmId, "documents", id))
        setDocuments(documents.filter(doc => doc.id !== id))
      } catch (error) {
        console.error("Error deleting document:", error)
      }
    }
  }

  const handleDownload = (fileUrl: string) => {
    window.open(fileUrl, '_blank')
  }

  const handleView = (fileUrl: string) => {
    window.open(fileUrl, '_blank')
  }

  if (loading) {
    return <div><LoadingComponent/></div>
  }

  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Firm Records</CardTitle>
          </CardHeader>
          <CardContent className="mt-6">
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-teal-600 mr-2" />
                        {doc.fileName}
                      </div>
                    </TableCell>
                    <TableCell>{doc.fileType}</TableCell>
                    <TableCell>{doc.uploadedAt}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleView(doc.fileUrl)}>
                            <Eye className="mr-2 h-4 w-4" />
                            <span>View</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(doc.fileUrl)}>
                            <Download className="mr-2 h-4 w-4" />
                            <span>Download</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(doc.id, doc.firmId)}>
                            <Trash className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}