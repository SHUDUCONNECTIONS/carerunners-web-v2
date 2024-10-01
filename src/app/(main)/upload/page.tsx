"use client"

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, File, CheckCircle, AlertCircle, Info } from "lucide-react";
import { db, auth, storage } from "@/utils/firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { User } from "firebase/auth";
import LoadingComponent from "@/components/loader";

type NotificationType = "info" | "success" | "error" | null;

export default function FirmDocumentUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState("");
  const [description, setDescription] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [notification, setNotification] = useState<{ type: NotificationType; message: string }>({ type: null, message: "" });
  const [firms, setFirms] = useState<{ id: string; name: string }[]>([]);
  const [selectedFirm, setSelectedFirm] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserFirms = async () => {
      if (!user) {
        setNotification({
          type: "error",
          message: "You must be logged in to view firms and upload documents.",
        });
        return;
      }

      // Check if a plan has been selected
      const storedPlan = JSON.parse(localStorage.getItem('selectedPlan'));
      if (!selectedPlan && !storedPlan) {
        setNotification({
          type: "error",
          message: "You must choose a plan to upload documents.",
        });
        return;
      }

      try {
        const firmsCollection = collection(db, "firms");
        const userFirmsQuery = query(firmsCollection, where("adminId", "==", user.uid));
        const firmsSnapshot = await getDocs(userFirmsQuery);
        const firmsList = firmsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().companyName }));
        setFirms(firmsList);

        if (firmsList.length === 0) {
          setNotification({
            type: "info",
            message: "You don't have any firms associated with your account.",
          });
        }
      } catch (error) {
        console.error("Error fetching user's firms:", error);
        setNotification({
          type: "error",
          message: "There was an error fetching your firms. Please try again later.",
        });
      }
    };

    if (user) {
      fetchUserFirms();
    }
  }, [user, selectedPlan]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus("idle");
      setUploadProgress(0);
      setNotification({ type: null, message: "" });
    }
  };

  const handleUpload = async () => {
    if (!file || !fileType || !description || !selectedFirm) {
      setNotification({
        type: "error",
        message: "Please fill in all fields before uploading.",
      });
      return;
    }

    setUploadStatus("uploading");
    setNotification({ type: null, message: "" });

    if (!user) {
      setNotification({
        type: "error",
        message: "You must be logged in to upload documents.",
      });
      return;
    }

    try {
      // Create a reference to the file in Firebase Storage
      const storageRef = ref(storage, `firms/${selectedFirm}/${file.name}`);
      
      // Start the file upload
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload error:", error);
          setUploadStatus("error");
          setNotification({
            type: "error",
            message: "There was an error uploading your file. Please try again.",
          });
        },
        async () => {
          // Upload completed successfully, now we can get the download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Add a new document to the firm's documents subcollection
          const docRef = await addDoc(collection(db, "firms", selectedFirm, "documents"), {
            fileName: file.name,
            fileType: fileType,
            description: description,
            uploadedBy: user.uid,
            uploadedAt: new Date(),
            fileUrl: downloadURL,
          });

          setUploadStatus("success");
          setNotification({
            type: "success",
            message: "Your file has been uploaded and processed successfully.",
          });

          setFileType("");
          setDescription("");
          setFile(null);
          setUploadProgress(0); 
        }
      );
    } catch (error) {
      console.error("Error during upload:", error);
      setUploadStatus("error");
      setNotification({
        type: "error",
        message: "There was an error uploading your file. Please try again.",
      });
    }
  };

  const NotificationBox = ({ type, message }: { type: NotificationType; message: string }) => {
    if (!type) return null;

    const bgColors = {
      info: "bg-blue-100 border-blue-500 text-blue-700",
      success: "bg-green-100 border-green-500 text-green-700",
      error: "bg-red-100 border-red-500 text-red-700",
    };

    const icons = {
      info: <Info className="h-5 w-5 mr-2" />,
      success: <CheckCircle className="h-5 w-5 mr-2" />,
      error: <AlertCircle className="h-5 w-5 mr-2" />,
    };

    return (
      <div className={`flex items-center p-4 mb-4 border-l-4 rounded-r ${bgColors[type]}`}>
        {icons[type]}
        <span>{message}</span>
      </div>
    );
  };

  if (loading) {
    return <LoadingComponent/>
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card>
          <CardContent>
            <p className="text-center">Please log in to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="bg-teal-600 text-white">
            <CardTitle className="text-2xl font-bold">Upload Firm Document</CardTitle>
          </CardHeader>
          <CardContent className="mt-6 space-y-6">
            {notification.type && (
              <NotificationBox type={notification.type} message={notification.message} />
            )}

            <div>
              <Label htmlFor="firm-select" className="block text-sm font-medium text-gray-700">
                Select Firm
              </Label>
              <Select onValueChange={setSelectedFirm}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select a firm" />
                </SelectTrigger>
                <SelectContent>
                  {firms.map((firm) => (
                    <SelectItem key={firm.id} value={firm.id}>
                      {firm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
                Select File
              </Label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-teal-600 hover:text-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-500"
                    >
                      <span>Upload a file</span>
                      <Input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.txt"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX or TXT up to 10MB</p>
                </div>
              </div>
              {file && (
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <File className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                  {file.name}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="file-type" className="block text-sm font-medium text-gray-700">
                Document Type
              </Label>
              <Select onValueChange={setFileType}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="legal_brief">Legal Brief</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="court_filing">Court Filing</SelectItem>
                  <SelectItem value="evidence">Evidence</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Briefly describe the contents of the file"
                className="mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {uploadStatus === "uploading" && (
              <div>
                <Label className="block text-sm font-medium text-gray-700">Upload Progress</Label>
                <Progress value={uploadProgress} className="mt-1" />
              </div>
            )}

            <Button
              onClick={handleUpload}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              disabled={uploadStatus === "uploading"}
            >
              {uploadStatus === "uploading" ? "Uploading..." : "Upload File"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}