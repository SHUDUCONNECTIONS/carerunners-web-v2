"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Check, Trash2, UserPlus, Clock } from "lucide-react";
import { auth, db } from "@/utils/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import LoadingComponent from "@/components/loader";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

type PlanTier = {
  name: string;
  price: number;
  description: string;
  features: string[];
  maxUsers: number;
};

type User = {
  id: string;
  name: string;
  email: string;
  status: "active";
};

type PendingInvite = {
  id: string;
  email: string;
  status: "pending";
};

// Update plan definitions to include maxUsers
const standardPlans: PlanTier[] = [
  {
    name: "Bronze",
    price: 50,
    description: "Great for getting started",
    features: ["Basic features", "Email support", "1 user"],
    maxUsers: 1,
  },
  {
    name: "Silver",
    price: 80,
    description: "Perfect for small teams",
    features: [
      "All Bronze features",
      "Priority support",
      "5 users",
      "Advanced analytics",
    ],
    maxUsers: 5,
  },
];

const premiumPlans: PlanTier[] = [
  {
    name: "Gold",
    price: 120,
    description: "Best for growing businesses",
    features: [
      "All Silver features",
      "24/7 phone support",
      "10 users",
      "Custom integrations",
    ],
    maxUsers: 10,
  },
  {
    name: "Platinum",
    price: 150,
    description: "For large enterprises",
    features: [
      "All Gold features",
      "Dedicated account manager",
      "Unlimited users",
      "Advanced security",
    ],
    maxUsers: Infinity,
  },
];

export default function PricingPage() {
  const [isPremium, setIsPremium] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<PlanTier | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]); // Updated type
  const [newUserEmail, setNewUserEmail] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUserFirmId(user.uid);
      } else {
        setLoading(false);
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchUserFirmId = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.firmId) {
          setFirmId(userData.firmId);
          fetchFirmData(userData.firmId);
        } else {
          console.error("User does not have an associated firmId");
          setLoading(false);
        }
      } else {
        console.error("User document not found");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching user's firmId:", error);
      setLoading(false);
    }
  };

  const fetchFirmData = async (firmId: string) => {
    try {
      const firmDoc = await getDoc(doc(db, "firms", firmId));
      if (firmDoc.exists()) {
        const firmData = firmDoc.data();
        if (firmData.paymentStatus === "paid" && firmData.selectedPlan) {
          setIsPaid(true);
          const planDetails = [...standardPlans, ...premiumPlans].find(
            (plan) => plan.name === firmData.selectedPlan
          );
          if (planDetails) {
            setCurrentPlan(planDetails);
          }
          await fetchUsers(firmId);
        }
      }
    } catch (error) {
      console.error("Error fetching firm data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (firmId: string) => {
    try {
      // Fetch active users
      const usersQuery = query(
        collection(db, "users"),
        where("firmId", "==", firmId)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        status: "active" as const,
      })) as User[];
      setUsers(usersData);

      // Fetch pending invites
      const invitesQuery = query(
        collection(db, "userInvitations"),
        where("firmId", "==", firmId),
        where("status", "==", "pending")
      );
      const invitesSnapshot = await getDocs(invitesQuery);
      const invitesData = invitesSnapshot.docs.map((doc) => ({
        id: doc.id,
        email: doc.data().email,
        status: "pending" as const,
      })) as PendingInvite[];
      setPendingInvites(invitesData); // Now this should work correctly
    } catch (error) {
      console.error("Error fetching users and invites:", error);
      setError("Failed to fetch users and invites");
    }
  };

  // Update type checking in inviteUser function
  const inviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPlan || !firmId) return;

    const totalUsers = users.length + pendingInvites.length;
    if (totalUsers >= currentPlan.maxUsers) {
      setError(
        `You've reached the maximum number of users (${currentPlan.maxUsers}) for your current plan.`
      );
      return;
    }

    const isExistingUser = [
      ...users.map((u) => u.email),
      ...pendingInvites.map((p) => p.email),
    ].includes(newUserEmail);

    if (isExistingUser) {
      setError("This email has already been invited or is an active user.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const invitationRef = await addDoc(collection(db, "userInvitations"), {
        email: newUserEmail,
        firmId: firmId,
        status: "pending",
        createdAt: new Date(),
      });

      const firmDoc = await getDoc(doc(db, "firms", firmId));
      const firmName = firmDoc.data()?.companyName || "Your Company";

      const invitationLink = `${window.location.origin}/accept-invitation?id=${invitationRef.id}`;

      const response = await fetch("/api/send-invitation-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUserEmail,
          firmName: firmName,
          invitationLink: invitationLink,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send invitation email");
      }

      await fetchUsers(firmId);
      setNewUserEmail("");
    } catch (error) {
      console.error("Error inviting user:", error);
      setError("Failed to send invitation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteInvite = async (inviteId: string) => {
    if (firmId) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, "userInvitations", inviteId));
        await fetchUsers(firmId);
      } catch (error) {
        console.error("Error deleting invite:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const deleteUser = async (userId: string) => {
    if (firmId) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, "users", userId));
        await fetchUsers(firmId);
      } catch (error) {
        console.error("Error deleting user:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const togglePremium = () => setIsPremium(!isPremium);

  const handlePlanSelection = async (plan: PlanTier) => {
    if (!firmId) {
      console.error("No firmId available");
      return;
    }

    setSelectedPlan(plan);
    setLoading(true);

    try {
      await updateDoc(doc(db, "firms", firmId), {
        selectedPlan: plan.name,
        planPrice: plan.price,
        updatedAt: new Date(),
      });

      router.push(
        `/pricing/payment?firmId=${firmId}&plan=${plan.name}&price=${plan.price}`
      );
    } catch (error) {
      console.error("Error updating firm with selected plan:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingComponent />;
  }

  if (currentPlan && isPaid) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <Card>
            <CardHeader className="bg-teal-600 text-white">
              <CardTitle className="text-2xl font-bold text-center">
                Your Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="mt-6">
              <h2 className="text-3xl font-bold text-center mb-4">
                {currentPlan.name}
              </h2>
              <p className="text-xl text-center mb-6">
                {currentPlan.description}
              </p>
              <div className="text-4xl font-bold text-center mb-6">
                R{currentPlan.price}
                <span className="text-lg font-normal">/mo</span>
              </div>
              <ul className="space-y-2">
                {currentPlan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <Check className="h-5 w-5 text-teal-500 mr-2 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">
                User Management
              </CardTitle>
              <CardDescription className="text-center">
                {currentPlan && (
                  <>
                    {users.length + pendingInvites.length} of{" "}
                    {currentPlan.maxUsers} users
                    {currentPlan.maxUsers !== Infinity &&
                      ` (${
                        currentPlan.maxUsers -
                        (users.length + pendingInvites.length)
                      } remaining)`}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <form onSubmit={inviteUser} className="flex space-x-2">
                  <Input
                    type="email"
                    placeholder="Enter email to invite"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="flex-grow"
                  />
                  <Button type="submit" disabled={loading}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite
                  </Button>
                </form>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <h3 className="font-semibold">
                    Active Users ({users.length})
                  </h3>
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-md"
                    >
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteUser(user.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {pendingInvites.length > 0 && (
                    <>
                      <h3 className="font-semibold mt-4">
                        Pending Invites ({pendingInvites.length})
                      </h3>
                      {pendingInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between bg-gray-50 p-3 rounded-md"
                        >
                          <div>
                            <p className="font-medium flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                              {invite.email}
                            </p>
                            <p className="text-sm text-gray-500">
                              Pending acceptance
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteInvite(invite.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Select the perfect plan for your needs
          </p>
          <div className="flex items-center justify-center space-x-4">
            <span
              className={`text-lg ${
                !isPremium ? "font-bold text-teal-600" : "text-gray-600"
              }`}
            >
              Standard
            </span>
            <Switch
              checked={isPremium}
              onCheckedChange={togglePremium}
              className="data-[state=checked]:bg-teal-600"
            />
            <span
              className={`text-lg ${
                isPremium ? "font-bold text-teal-600" : "text-gray-600"
              }`}
            >
              Premium
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
          {(isPremium ? premiumPlans : standardPlans).map((plan) => (
            <Card key={plan.name} className="w-full max-w-sm flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="text-4xl font-bold mb-4">
                  R{plan.price}
                  <span className="text-lg font-normal">/mo</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-teal-500 mr-2 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => handlePlanSelection(plan)}
                  disabled={
                    loading || (selectedPlan && selectedPlan.name === plan.name)
                  }
                >
                  {loading && selectedPlan && selectedPlan.name === plan.name
                    ? "Processing..."
                    : selectedPlan && selectedPlan.name === plan.name
                    ? "Selected"
                    : "Choose Plan"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
