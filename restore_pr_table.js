const fs = require("fs");

const file = "/var/www/emv/src/components/admin/PaymentRequestsTable.tsx";
let content = fs.readFileSync(file, "utf8");

// Remove the broken start and add proper imports
const properStart = `"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { formatRub, rublesToKopecksRoundedUp } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { SearchSelect } from "@/components/SearchSelect";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import {
  exportPaymentRequests,
  updatePaymentRequestStatus,
} from "@/actions/admin/payment-requests";
import { useRememberedState } from "@/components/admin/AdminPlaces";

const PAYMENT_REQUEST_STATUSES = ["Требуется оплата", "Оплачено", "Отменено"];
type PaymentRequestInput = {
  amount: number;
  purpose: string;
  companyId?: string;
  orderId?: string;
  extraCostId?: string;
  purchaseId?: string;
  fund?: string;
  managerId?: string;
  inn?: string;
};

`;

// Find where the actual component function starts
const componentStart = content.indexOf("export function PaymentRequestsTable");
if (componentStart > 0) {
  content = properStart + content.slice(componentStart);
  fs.writeFileSync(file, content);
  console.log("Restored PaymentRequestsTable.tsx");
} else {
  console.log("Could not find component start");
}
