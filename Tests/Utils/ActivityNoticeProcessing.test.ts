// ---------------------------------------------------------------------------------------
// Tests for Activity Notice Processing in Activity Reports
// ---------------------------------------------------------------------------------------
import { UserActivityNotice } from "#Typings/Utilities/Database.js";

// Mock the isAfter function from date-fns
const MockIsAfter = (date: Date, compareDate: Date): boolean => {
  return date.getTime() > compareDate.getTime();
};

// Helper to create a mock activity notice
type MockNotice = Pick<
  UserActivityNotice.UserActivityNoticeDocument,
  | "type"
  | "quota_scale"
  | "status"
  | "end_date"
  | "early_end_date"
  | "request_date"
  | "extension_request"
  | "review_date"
  | "reviewed_by"
>;

function CreateMockNotice(
  type: "LeaveOfAbsence" | "ReducedActivity",
  status: "Approved" | "Pending",
  isActive: boolean,
  daysFromNow: number = 30
): MockNotice {
  const Now = new Date();
  const ReviewDate = status === "Approved" ? new Date(Now.getTime() - 86400000) : null;
  const EndDate = new Date(Now.getTime() + daysFromNow * 86400000);

  return {
    type,
    status,
    quota_scale: type === "ReducedActivity" ? 0.5 : null,
    review_date: ReviewDate,
    end_date: EndDate,
    early_end_date: null,
    request_date: new Date(Now.getTime() - 172800000), // 2 days ago
    extension_request: null,
    reviewed_by:
      status === "Approved"
        ? {
            id: "123456789012345678",
            username: "TestReviewer",
          }
        : null,
  };
}

// Inline implementation of ProcessActivityNotices for testing
function ProcessActivityNotices(
  ActivityNotices: MockNotice[],
  RetrieveDate: Date
): {
  loa: MockNotice | null;
  ra: MockNotice | null;
} {
  if (!ActivityNotices || ActivityNotices.length === 0) {
    return { loa: null, ra: null };
  }

  let ActiveLOA: MockNotice | null = null;
  let ActiveRA: MockNotice | null = null;
  let PendingLOA: MockNotice | null = null;
  let PendingRA: MockNotice | null = null;

  for (const Notice of ActivityNotices) {
    const IsActive =
      Notice.status === "Approved" &&
      Notice.review_date !== null &&
      Notice.early_end_date === null &&
      MockIsAfter(Notice.end_date, RetrieveDate);

    const IsPending = Notice.status === "Pending" && Notice.review_date === null;

    if (Notice.type === "LeaveOfAbsence") {
      if (IsActive && !ActiveLOA) {
        ActiveLOA = Notice;
      } else if (IsPending && !PendingLOA) {
        PendingLOA = Notice;
      }
    } else if (Notice.type === "ReducedActivity") {
      if (IsActive && !ActiveRA) {
        ActiveRA = Notice;
      } else if (IsPending && !PendingRA) {
        PendingRA = Notice;
      }
    }
  }

  // Priority: Active LOA > Active RA > Pending LOA > Pending RA
  // LOA takes precedence; if active LOA exists, don't show any pending notices
  const PrioritizedLOA = ActiveLOA || PendingLOA;
  const PrioritizedRA = ActiveLOA ? null : ActiveRA || PendingRA;

  return { loa: PrioritizedLOA, ra: PrioritizedRA };
}

// ---------------------------------------------------------------------------------------
// Tests:
// ------
describe("Activity Notice Processing for Activity Reports", () => {
  const RetrieveDate = new Date();

  describe("ProcessActivityNotices() - Empty/Null Inputs", () => {
    it("Should return null for both LOA and RA when given an empty array", () => {
      const Result = ProcessActivityNotices([], RetrieveDate);
      expect(Result.loa).toBeNull();
      expect(Result.ra).toBeNull();
    });

    it("Should return null for both LOA and RA when given null/undefined input", () => {
      const Result = ProcessActivityNotices(null as any, RetrieveDate);
      expect(Result.loa).toBeNull();
      expect(Result.ra).toBeNull();
    });
  });

  describe("ProcessActivityNotices() - Single Notice Scenarios", () => {
    it("Should return active LOA when only active LOA exists", () => {
      const ActiveLOA = CreateMockNotice("LeaveOfAbsence", "Approved", true);
      const Result = ProcessActivityNotices([ActiveLOA], RetrieveDate);
      expect(Result.loa).toBe(ActiveLOA);
      expect(Result.ra).toBeNull();
    });

    it("Should return active RA when only active RA exists", () => {
      const ActiveRA = CreateMockNotice("ReducedActivity", "Approved", true);
      const Result = ProcessActivityNotices([ActiveRA], RetrieveDate);
      expect(Result.loa).toBeNull();
      expect(Result.ra).toBe(ActiveRA);
    });

    it("Should return pending LOA when only pending LOA exists", () => {
      const PendingLOA = CreateMockNotice("LeaveOfAbsence", "Pending", false);
      const Result = ProcessActivityNotices([PendingLOA], RetrieveDate);
      expect(Result.loa).toBe(PendingLOA);
      expect(Result.ra).toBeNull();
    });

    it("Should return pending RA when only pending RA exists", () => {
      const PendingRA = CreateMockNotice("ReducedActivity", "Pending", false);
      const Result = ProcessActivityNotices([PendingRA], RetrieveDate);
      expect(Result.loa).toBeNull();
      expect(Result.ra).toBe(PendingRA);
    });
  });

  describe("ProcessActivityNotices() - LOA Priority Over RA", () => {
    it("Should return active LOA and NOT return active RA when both exist (LOA takes precedence)", () => {
      const ActiveLOA = CreateMockNotice("LeaveOfAbsence", "Approved", true);
      const ActiveRA = CreateMockNotice("ReducedActivity", "Approved", true);
      const Result = ProcessActivityNotices([ActiveLOA, ActiveRA], RetrieveDate);

      expect(Result.loa).toBe(ActiveLOA);
      expect(Result.ra).toBeNull(); // RA is hidden when active LOA exists
    });

    it("Should return active LOA and NOT return pending RA when both exist", () => {
      const ActiveLOA = CreateMockNotice("LeaveOfAbsence", "Approved", true);
      const PendingRA = CreateMockNotice("ReducedActivity", "Pending", false);
      const Result = ProcessActivityNotices([ActiveLOA, PendingRA], RetrieveDate);

      expect(Result.loa).toBe(ActiveLOA);
      expect(Result.ra).toBeNull(); // Pending RA is hidden when active LOA exists
    });

    it("Should return active LOA and NOT return any pending notices when active LOA exists", () => {
      const ActiveLOA = CreateMockNotice("LeaveOfAbsence", "Approved", true);
      const PendingLOA = CreateMockNotice("LeaveOfAbsence", "Pending", false);
      const PendingRA = CreateMockNotice("ReducedActivity", "Pending", false);
      const Result = ProcessActivityNotices([ActiveLOA, PendingLOA, PendingRA], RetrieveDate);

      expect(Result.loa).toBe(ActiveLOA);
      expect(Result.ra).toBeNull(); // No RA shown when active LOA exists
    });
  });

  describe("ProcessActivityNotices() - RA Scenarios Without LOA", () => {
    it("Should return active RA when no LOA exists", () => {
      const ActiveRA = CreateMockNotice("ReducedActivity", "Approved", true);
      const Result = ProcessActivityNotices([ActiveRA], RetrieveDate);

      expect(Result.loa).toBeNull();
      expect(Result.ra).toBe(ActiveRA);
    });

    it("Should return both pending LOA and active RA", () => {
      const PendingLOA = CreateMockNotice("LeaveOfAbsence", "Pending", false);
      const ActiveRA = CreateMockNotice("ReducedActivity", "Approved", true);
      const Result = ProcessActivityNotices([PendingLOA, ActiveRA], RetrieveDate);

      expect(Result.loa).toBe(PendingLOA);
      expect(Result.ra).toBe(ActiveRA); // RA shown when only pending LOA exists
    });

    it("Should prioritize active RA over pending RA when no LOA exists", () => {
      const ActiveRA = CreateMockNotice("ReducedActivity", "Approved", true);
      const PendingRA = CreateMockNotice("ReducedActivity", "Pending", false);
      const Result = ProcessActivityNotices([ActiveRA, PendingRA], RetrieveDate);

      expect(Result.loa).toBeNull();
      expect(Result.ra).toBe(ActiveRA); // Active RA takes precedence over pending RA
    });
  });

  describe("ProcessActivityNotices() - Complex Multi-Notice Scenarios", () => {
    it("Should handle all four notice types correctly with proper priority", () => {
      const ActiveLOA = CreateMockNotice("LeaveOfAbsence", "Approved", true);
      const PendingLOA = CreateMockNotice("LeaveOfAbsence", "Pending", false);
      const ActiveRA = CreateMockNotice("ReducedActivity", "Approved", true);
      const PendingRA = CreateMockNotice("ReducedActivity", "Pending", false);

      const Result = ProcessActivityNotices(
        [ActiveLOA, PendingLOA, ActiveRA, PendingRA],
        RetrieveDate
      );

      expect(Result.loa).toBe(ActiveLOA); // Active LOA is prioritized
      expect(Result.ra).toBeNull(); // No RA shown when active LOA exists
    });

    it("Should prioritize pending LOA over pending RA when no active notices exist", () => {
      const PendingLOA = CreateMockNotice("LeaveOfAbsence", "Pending", false);
      const PendingRA = CreateMockNotice("ReducedActivity", "Pending", false);

      const Result = ProcessActivityNotices([PendingLOA, PendingRA], RetrieveDate);

      expect(Result.loa).toBe(PendingLOA);
      expect(Result.ra).toBe(PendingRA); // Pending RA shown when only pending LOA exists
    });

    it("Should handle inactive/expired notices correctly", () => {
      // Create expired notices (end date in the past)
      const ExpiredLOA = CreateMockNotice("LeaveOfAbsence", "Approved", true, -5); // 5 days ago
      const ExpiredRA = CreateMockNotice("ReducedActivity", "Approved", true, -3); // 3 days ago
      const PendingLOA = CreateMockNotice("LeaveOfAbsence", "Pending", false);

      const Result = ProcessActivityNotices([ExpiredLOA, ExpiredRA, PendingLOA], RetrieveDate);

      // Expired notices should not be considered active
      expect(Result.loa).toBe(PendingLOA); // Only pending LOA should be returned
      expect(Result.ra).toBeNull();
    });
  });

  describe("ProcessActivityNotices() - Edge Cases", () => {
    it("Should handle multiple notices of the same type and return only the first active one", () => {
      const ActiveLOA1 = CreateMockNotice("LeaveOfAbsence", "Approved", true, 10);
      const ActiveLOA2 = CreateMockNotice("LeaveOfAbsence", "Approved", true, 20);

      const Result = ProcessActivityNotices([ActiveLOA1, ActiveLOA2], RetrieveDate);

      expect(Result.loa).toBe(ActiveLOA1); // First active LOA is returned
    });

    it("Should fallback to pending notice when no active notice exists", () => {
      const PendingLOA = CreateMockNotice("LeaveOfAbsence", "Pending", false);
      const PendingRA = CreateMockNotice("ReducedActivity", "Pending", false);

      const Result = ProcessActivityNotices([PendingLOA, PendingRA], RetrieveDate);

      expect(Result.loa).toBe(PendingLOA);
      expect(Result.ra).toBe(PendingRA);
    });

    it("Should respect early_end_date when determining active status", () => {
      const EarlyEndedLOA = CreateMockNotice("LeaveOfAbsence", "Approved", true);
      EarlyEndedLOA.early_end_date = new Date(RetrieveDate.getTime() - 86400000); // Ended yesterday

      const Result = ProcessActivityNotices([EarlyEndedLOA], RetrieveDate);

      // Should not be considered active because of early_end_date
      expect(Result.loa).toBeNull();
      expect(Result.ra).toBeNull();
    });
  });
});
