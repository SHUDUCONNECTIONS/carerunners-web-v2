"use client";


import React, { useState } from "react";
import { fetchSignInMethodsForEmail } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Mail,
  AlertCircle,


  Lock,
  Phone,  MapPin,
  Car,
  FileText,
  ChevronRight,
  ChevronLeft,
  Upload,
} from "lucide-react";
import { auth, db, storage, rtdb } from "@/utils/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { ref as dbRef, set } from "firebase/database";
import { useRouter } from "next/navigation";


const steps = [
  "Personal Details",
  "Vehicle Information",
  "Document Submission",
];


export default function DriverSignUpStepper() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    baseLocation: "",
    vehicleType: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: "",
    numberPlate: "",
    vehicleColor: "",
    licenseNumber: "",
    insuranceProvider: "",
    insuranceNumber: "",
    identificationDoc: null as File | null,
    proofOfResidenceDoc: null as File | null,
    isApproved: false,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };


  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (files && files.length > 0) {
      setFormData({ ...formData, [name]: files[0] });
    }
  };


  const validateStep = (step: number) => {
    const newErrors: { [key: string]: string } = {};


    switch (step) {
      case 0:
        if (!formData.firstName.trim())
          newErrors.firstName = "First name is required";
        if (!formData.lastName.trim())
          newErrors.lastName = "Last name is required";
        if (!formData.email.trim()) newErrors.email = "Email is required";
        if (!/\S+@\S+\.\S+/.test(formData.email))
          newErrors.email = "Email is invalid";
        if (!formData.phone.trim())
          newErrors.phone = "Phone number is required";
        if (!/^\d{10}$/.test(formData.phone))
          newErrors.phone = "Phone number must be 10 digits";
        if (!formData.password) newErrors.password = "Password is required";
        if (formData.password.length < 8)
          newErrors.password = "Password must be at least 8 characters";
        if (formData.password !== formData.confirmPassword)
          newErrors.confirmPassword = "Passwords do not match";
        if (!formData.baseLocation.trim())
          newErrors.baseLocation = "Base location is required";
        break;
      case 1:
        if (!formData.vehicleType)
          newErrors.vehicleType = "Vehicle type is required";
        if (!formData.vehicleMake.trim())
          newErrors.vehicleMake = "Vehicle make is required";
        if (!formData.vehicleModel.trim())
          newErrors.vehicleModel = "Vehicle model is required";
        if (!formData.numberPlate.trim())
          newErrors.numberPlate = "Number plate is required";
        if (!formData.vehicleColor.trim())
          newErrors.vehicleColor = "Vehicle color is required";
        if (!formData.vehicleYear.trim())
          newErrors.vehicleYear = "Vehicle year is required";
        if (!/^\d{4}$/.test(formData.vehicleYear))
          newErrors.vehicleYear = "Vehicle year must be 4 digits";
        break;
      case 2:
        if (!formData.licenseNumber.trim())
          newErrors.licenseNumber = "Driver's license number is required";
        if (!formData.insuranceProvider.trim())
          newErrors.insuranceProvider = "Insurance provider is required";
        if (!formData.insuranceNumber.trim())
          newErrors.insuranceNumber = "Insurance policy number is required";
        if (!formData.identificationDoc)
          newErrors.identificationDoc = "Identification document is required";
        if (!formData.proofOfResidenceDoc)
          newErrors.proofOfResidenceDoc =
            "Proof of residence document is required";
        break;
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };


  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };


  const uploadFile = async (file: File, path: string) => {
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep(currentStep)) {
      setLoading(true);
      try {
        // Check if email already exists
        const signInMethods = await fetchSignInMethodsForEmail(
          auth,
          formData.email
        );
        if (signInMethods.length > 0) {
          setErrors({
            email:
              "This email is already registered. Please use a different email.",
          });
          setCurrentStep(0); // Go back to the first step where email input is
          return;
        }


        // Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        const user = userCredential.user;


        // Upload documents to Firebase Storage
        const idDocUrl = formData.identificationDoc
          ? await uploadFile(
              formData.identificationDoc,
              `drivers/${user.uid}/identification`
            )
          : null;
        const residenceDocUrl = formData.proofOfResidenceDoc
          ? await uploadFile(
              formData.proofOfResidenceDoc,
              `drivers/${user.uid}/residence_proof`
            )
          : null;


        const driverData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          baseLocation: formData.baseLocation,
          vehicleType: formData.vehicleType,
          vehicleMake: formData.vehicleMake,
          vehicleModel: formData.vehicleModel,
          vehicleYear: formData.vehicleYear,
          numberPlate: formData.numberPlate,
          vehicleColor: formData.vehicleColor,
          licenseNumber: formData.licenseNumber,
          insuranceProvider: formData.insuranceProvider,
          insuranceNumber: formData.insuranceNumber,
          identificationDocUrl: idDocUrl,
          proofOfResidenceDocUrl: residenceDocUrl,
          isApproved: false,
        };

        // Write to Firestore (web portal)
        await setDoc(doc(db, "drivers", user.uid), {
          ...driverData,
          createdAt: new Date(),
        });

        // Write to Realtime Database (driver mobile app)
        await set(dbRef(rtdb, `drivers/${user.uid}`), {
          ...driverData,
          createdAt: Date.now(),
        });


        // Redirect to a success page or dashboard
        router.push("/driver/application");
      } catch (error: any) {
        console.error("Error during driver signup:", error);


        // Handle specific Firebase auth errors
        if (error.code === "auth/email-already-in-use") {
          setErrors({
            email:
              "This email is already registered. Please use a different email.",
          });
          setCurrentStep(0); // Go back to the first step where email input is
        } else {
          setErrors({
            submit: "An error occurred during signup. Please try again later.",
          });
        }
      } finally {
        setLoading(false);
      }
    }
  };


  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.firstName ? "border-red-500" : ""
                    }`}
                    placeholder="First Name"
                    value={formData.firstName}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.firstName}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.lastName ? "border-red-500" : ""
                    }`}
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>


              <div>
                <Label htmlFor="email">Email</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className={`pl-10 block w-full ${
                      errors.email ? "border-red-500" : ""
                    }`}
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>


              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    className={`pl-10 block w-full ${
                      errors.phone ? "border-red-500" : ""
                    }`}
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>


              <div>
                <Label htmlFor="password">Password</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className={`pl-10 block w-full ${
                      errors.password ? "border-red-500" : ""
                    }`}
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>


              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className={`pl-10 block w-full ${
                      errors.confirmPassword ? "border-red-500" : ""
                    }`}
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>


              <div className="sm:col-span-2">
                <Label htmlFor="baseLocation">Base Location</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="baseLocation"
                    name="baseLocation"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.baseLocation ? "border-red-500" : ""
                    }`}
                    placeholder="Your base location"
                    value={formData.baseLocation}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.baseLocation && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.baseLocation}
                  </p>
                )}
              </div>
            </div>
          </>
        );
      case 1:
        return (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="vehicleType">Vehicle Type</Label>
                <Select
                  onValueChange={(value) =>
                    handleSelectChange("vehicleType", value)
                  }
                >
                  <SelectTrigger
                    className={`w-full mt-1 ${
                      errors.vehicleType ? "border-red-500" : ""
                    }`}
                  >
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedan">Sedan</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="hatchback">Hatchback</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                  </SelectContent>
                </Select>
                {errors.vehicleType && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleType}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="vehicleMake">Vehicle Make</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="vehicleMake"
                    name="vehicleMake"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.vehicleMake ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Make"
                    value={formData.vehicleMake}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.vehicleMake && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleMake}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="vehicleModel">Vehicle Model</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="vehicleModel"
                    name="vehicleModel"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.vehicleModel ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Model"
                    value={formData.vehicleModel}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.vehicleModel && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleModel}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="vehicleYear">Vehicle Year</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="vehicleYear"
                    name="vehicleYear"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.vehicleYear ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Year"
                    value={formData.vehicleYear}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.vehicleYear && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleYear}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="numberPlate">Number Plate</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="numberPlate"
                    name="numberPlate"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.numberPlate ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Number Plate"
                    value={formData.numberPlate}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.numberPlate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.numberPlate}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="vehicleColor">Vehicle Color</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="vehicleColor"
                    name="vehicleColor"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.vehicleColor ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Color"
                    value={formData.vehicleColor}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.vehicleColor && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleColor}
                  </p>
                )}
              </div>
            </div>
          </>
        );
      case 1:
        return (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="vehicleType">Vehicle Type</Label>
                <Select
                  onValueChange={(value) =>
                    handleSelectChange("vehicleType", value)
                  }
                >
                  <SelectTrigger
                    className={`w-full mt-1 ${
                      errors.vehicleType ? "border-red-500" : ""
                    }`}
                  >
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedan">Sedan</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                  </SelectContent>
                </Select>
                {errors.vehicleType && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleType}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="vehicleMake">Vehicle Make</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="vehicleMake"
                    name="vehicleMake"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.vehicleMake ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Make"
                    value={formData.vehicleMake}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.vehicleMake && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleMake}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="vehicleModel">Vehicle Model</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="vehicleModel"
                    name="vehicleModel"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.vehicleModel ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Model"
                    value={formData.vehicleModel}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.vehicleModel && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleModel}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="vehicleYear">Vehicle Year</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="vehicleYear"
                    name="vehicleYear"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.vehicleYear ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Year"
                    value={formData.vehicleYear}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.vehicleYear && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleYear}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="numberPlate">Number Plate</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="numberPlate"
                    name="numberPlate"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.numberPlate ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Number Plate"
                    value={formData.numberPlate}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.numberPlate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.numberPlate}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="vehicleColor">Vehicle Color</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="vehicleColor"
                    name="vehicleColor"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.vehicleColor ? "border-red-500" : ""
                    }`}
                    placeholder="Vehicle Color"
                    value={formData.vehicleColor}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.vehicleColor && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.vehicleColor}
                  </p>
                )}
              </div>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="licenseNumber">Driver's License Number</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.licenseNumber ? "border-red-500" : ""
                    }`}
                    placeholder="License Number"
                    value={formData.licenseNumber}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.licenseNumber && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.licenseNumber}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="insuranceProvider"
                    name="insuranceProvider"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.insuranceProvider ? "border-red-500" : ""
                    }`}
                    placeholder="Insurance Provider"
                    value={formData.insuranceProvider}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.insuranceProvider && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.insuranceProvider}
                  </p>
                )}
              </div>


              <div>
                <Label htmlFor="insuranceNumber">Insurance Policy Number</Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="insuranceNumber"
                    name="insuranceNumber"
                    type="text"
                    required
                    className={`pl-10 block w-full ${
                      errors.insuranceNumber ? "border-red-500" : ""
                    }`}
                    placeholder="Insurance Policy Number"
                    value={formData.insuranceNumber}
                    onChange={handleInputChange}
                  />
                </div>
                {errors.insuranceNumber && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.insuranceNumber}
                  </p>
                )}
              </div>


              <div className="sm:col-span-2">
                <Label htmlFor="identificationDoc">
                  Identification Document
                </Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Upload className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="identificationDoc"
                    name="identificationDoc"
                    type="file"
                    required
                    className={`pl-10 block w-full ${
                      errors.identificationDoc ? "border-red-500" : ""
                    }`}
                    onChange={handleFileChange}
                  />
                </div>
                {errors.identificationDoc && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.identificationDoc}
                  </p>
                )}
              </div>


              <div className="sm:col-span-2">
                <Label htmlFor="proofOfResidenceDoc">
                  Proof of Residence Document
                </Label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Upload className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="proofOfResidenceDoc"
                    name="proofOfResidenceDoc"
                    type="file"
                    required
                    className={`pl-10 block w-full ${
                      errors.proofOfResidenceDoc ? "border-red-500" : ""
                    }`}
                    onChange={handleFileChange}
                  />
                </div>
                {errors.proofOfResidenceDoc && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.proofOfResidenceDoc}
                  </p>
                )}
              </div>
            </div>
          </>
        );
      default:
        return null;
    }
  };


  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-4xl">
        <CardHeader className="bg-teal-600 text-white">
          <CardTitle className="text-2xl font-bold text-center">
            Driver Sign Up
          </CardTitle>
        </CardHeader>
        <div className="mx-auto w-32 h-32">
          <img
            src="/carerunnerlogo.png"
            alt="Care Runners Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <CardContent className="mt-6">
          <div className="mb-8">
            <ol className="flex items-center w-full text-sm font-medium text-center text-gray-500 dark:text-gray-400 sm:text-base">
              {steps.map((step, index) => (
                <li
                  key={index}
                  className={`flex md:w-full items-center ${
                    index <= currentStep
                      ? "text-teal-600 dark:text-teal-500"
                      : "text-gray-500 dark:text-gray-400"
                  } sm:after:content-[''] after:w-full after:h-1 after:border-b after:border-gray-200 after:border-1 after:hidden sm:after:inline-block after:mx-6 xl:after:mx-10 dark:after:border-gray-700`}
                >
                  <span className="flex items-center after:content-['/'] sm:after:hidden after:mx-2 after:text-gray-200 dark:after:text-gray-500">
                    {index < currentStep ? (
                      <svg
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2.5"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z" />
                      </svg>
                    ) : (
                      <span className="mr-2">{index + 1}</span>
                    )}
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>


          <form onSubmit={handleSubmit}>
            {renderStep()}
            <div className="mt-8 flex justify-between">
              {currentStep > 0 && (
                <Button
                  type="button"
                  onClick={handlePrevious}
                  className="bg-gray-300 text-gray-700 hover:bg-gray-400"
                  disabled={loading}
                >
                  <ChevronLeft className="h-5 w-5 mr-2" />
                  Previous
                </Button>
              )}
              {currentStep < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="bg-teal-600 text-white hover:bg-teal-700 ml-auto"
                  disabled={loading}
                >
                  Next
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="bg-teal-600 text-white hover:bg-teal-700 ml-auto"
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Submit"}
                </Button>
              )}
            </div>
          </form>


          {errors.submit && (
            <div className="mt-4 text-red-600 text-sm flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              {errors.submit}
            </div>
          )}

          <div className="mt-6 text-center border-t pt-4">
            <p className="text-sm text-gray-600">Already have an account?</p>
            <Button
              type="button"
              variant="link"
              className="text-teal-600 font-medium"
              onClick={() => router.push("/auth/driver/login")}
            >
              Sign in to Driver Portal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


