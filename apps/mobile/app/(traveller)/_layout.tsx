import React from "react";
import { Tabs } from "expo-router";
import { MobileIcon } from "../../src/components/MobileIcon";
import { mobileColors } from "../../src/lib/theme";

export default function TravellerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: mobileColors.terracotta[500],
        tabBarInactiveTintColor: mobileColors.sand[600],
        tabBarStyle: {
          backgroundColor: mobileColors.navy[900],
          borderTopColor: mobileColors.navy[800],
          height: 62,
          paddingBottom: 8,
          paddingTop: 6
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Explore",
          tabBarLabel: "Explore",
          tabBarIcon: ({ color }) => (
            <MobileIcon name="search" size={20} color={color ? String(color) : mobileColors.sand[600]} />
          )
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "My Storage",
          tabBarLabel: "My Storage",
          tabBarIcon: ({ color }) => (
            <MobileIcon name="briefcase" size={20} color={color ? String(color) : mobileColors.sand[600]} />
          )
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarLabel: "Saved",
          tabBarIcon: ({ color }) => (
            <MobileIcon name="bookmark" size={20} color={color ? String(color) : mobileColors.sand[600]} />
          )
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: "Support",
          tabBarLabel: "Support",
          tabBarIcon: ({ color }) => (
            <MobileIcon name="help-circle" size={20} color={color ? String(color) : mobileColors.sand[600]} />
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Account",
          tabBarLabel: "Account",
          tabBarIcon: ({ color }) => (
            <MobileIcon name="user" size={20} color={color ? String(color) : mobileColors.sand[600]} />
          )
        }}
      />

      {/* Stack & Detail routes hidden from bottom tab bar */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
          title: "Map Discovery"
        }}
      />
      <Tabs.Screen
        name="location"
        options={{
          href: null,
          title: "Location Details"
        }}
      />
      <Tabs.Screen
        name="checkout"
        options={{
          href: null,
          title: "Booking Checkout"
        }}
      />
      <Tabs.Screen
        name="pass"
        options={{
          href: null,
          title: "Custody Pass"
        }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{
          href: null,
          title: "Welcome"
        }}
      />
    </Tabs>
  );
}
