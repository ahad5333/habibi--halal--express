const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const protect = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const { handleValidation, body } = require('../middleware/validate');
const safeError = require('../utils/safeError');
const {
  getDashboardStats,
  getMerchantOrders,
  getAllOrders,
  getAllMenus,
  updateOrderStatus,
  updatePaymentStatus,
  addItemToOrder,
  getSidebarItems,
  getAllCustomers,
  exportCustomers,
  getTopCustomers,
  getCustomerDetails,
  createCustomer,
  updateCustomer,
  bulkDeleteCustomers,
  bulkImportCustomers,
  getDeliveryTiers,
  updateDeliveryTier,
  updateOrderProvider,
  getAdminLocations,
  updateAdminLocation,
  toggleLocation,
  toggleMenuAvailability,
  getLocationMenuAvailability,
  setLocationMenuAvailability,
  setBulkLocationMenuAvailability,
  getCouponStats,
  getChatConversations,
  getChatMessages,
  sendAdminChatMessage,
  getLoyaltyStats,
  getLoyaltyCustomers,
  adjustLoyaltyPoints,
  getLoyaltyConfig,
  updateLoyaltyConfig,
  getLoyaltyTiers,
  updateLoyaltyTiers,
} = require("../controllers/adminController");
const { changeAdminPassword } = require('../controllers/authController');
const { getRevenueAnalytics, getCustomerGrowth } = require("../controllers/analyticsController");
const { syncCatalogToPartners, updatePartnerAvailability } = require("../controllers/catalogController");
const { getPartnerApplications, updateApplicationStatus } = require("../controllers/partnerController");
const {
  getChoiceGroups,
  createChoiceGroup,
  getAddonGroups,
  createAddonGroup,
  deleteChoiceGroup,
  deleteAddonGroup,
  getModifiers,
  createModifier,
  updateModifier,
  deleteModifier
} = require("../controllers/modifierController");

const merchant = require("../middleware/merchantMiddleware");

// All admin routes require authentication
router.use(protect);

// ── Merchant-accessible routes (admin / superadmin / merchant) ────────────
// These must come BEFORE router.use(admin) so merchant tokens can reach them.
router.get("/orders/merchant", merchant, getMerchantOrders);
router.patch("/orders/:id/status", merchant, updateOrderStatus);
router.patch("/orders/:id/payment-status", merchant, updatePaymentStatus);

// ── Admin-only routes (admin / superadmin only) ───────────────────────────
router.use(admin);

// Sidebar items
router.get("/sidebar", getSidebarItems);

// Analytics & Stats
router.get("/stats", getDashboardStats);
router.get("/analytics/revenue", getRevenueAnalytics);
router.get("/analytics/growth", getCustomerGrowth);

// Global Orders
router.get("/orders", getAllOrders);
router.post("/orders/:id/add-item", protect, admin, addItemToOrder);
router.patch("/orders/:id/provider", updateOrderProvider);

// Customers
router.get("/customers", getAllCustomers);
router.get("/customers/export", exportCustomers);
router.get("/customers/top", getTopCustomers);
router.post("/customers", createCustomer);
router.post("/customers/bulk-import", bulkImportCustomers);
router.post("/customers/bulk-delete", bulkDeleteCustomers);
router.get("/customers/:id", getCustomerDetails);
router.patch("/customers/:id", updateCustomer);

// Delivery Tiers
router.get("/delivery-tiers", getDeliveryTiers);
router.put("/delivery-tiers/:id", updateDeliveryTier);

// Catalog / Partner Sync
router.post("/catalog/sync", syncCatalogToPartners);
router.patch("/catalog/partner-availability", updatePartnerAvailability);

// Partner Management
router.get("/partners/applications", getPartnerApplications);
router.patch("/partners/applications/:id", updateApplicationStatus);

// Master Menu
const { createMenu, updateMenu, deleteMenu } = require("../controllers/menuController");
const { getBusinessMenus, createBusinessMenu, updateBusinessMenu, deleteBusinessMenu, bulkImportBusinessMenus } = require("../controllers/businessMenuController");
const {
  getAdminByoIngredients, createByoIngredient, updateByoIngredient, deleteByoIngredient,
} = require("../controllers/byoIngredientController");
const upload = require("../middleware/uploadMiddleware");
const uploadByoImages = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'rim_image', maxCount: 1 }]);

router.get("/menus", getAllMenus);
router.patch("/menus/availability", toggleMenuAvailability);
router.get("/menus/location-availability", getLocationMenuAvailability);
router.post("/menus/location-availability", setLocationMenuAvailability);
router.post("/menus/location-availability/bulk", setBulkLocationMenuAvailability);
router.post("/menus", upload.single("image"), createMenu);
router.patch("/menus/:id", upload.single("image"), updateMenu);
router.delete("/menus/:id", deleteMenu);

// Build-Your-Own ingredients (bases/cheese/veg/protein/sauce)
router.get("/byo-ingredients", getAdminByoIngredients);
router.post("/byo-ingredients", uploadByoImages, createByoIngredient);
router.patch("/byo-ingredients/:id", uploadByoImages, updateByoIngredient);
router.delete("/byo-ingredients/:id", deleteByoIngredient);

// Modifiers (shared choice groups & addon groups)
router.get("/modifiers",         getModifiers);
router.post("/modifiers",        createModifier);
router.patch("/modifiers/:id",   updateModifier);
router.delete("/modifiers/:id",  deleteModifier);

// Global Addon Groups (Sauces, Make it a Meal!, Add a Drink)
const { getGlobalAddonGroups, updateGlobalAddonGroup } = require('../controllers/globalAddonController');
router.get("/global-addons",        getGlobalAddonGroups);
router.patch("/global-addons/:id",  updateGlobalAddonGroup);

// Business Menus
router.get("/business-menus", getBusinessMenus);
router.post("/business-menus", upload.single("image"), createBusinessMenu);
router.post("/business-menus/bulk-import", bulkImportBusinessMenus);
router.patch("/business-menus/:id", upload.single("image"), updateBusinessMenu);
router.delete("/business-menus/:id", deleteBusinessMenu);

// Payments (standalone)
router.get("/payments", async (req, res) => {
  try {
    const [rows, stats, byMethod, quickPayments] = await Promise.all([
      pool.query(`
        SELECT id, order_number, customer_name, customer_email,
               payment_method, delivery_method,
               sub_total, tax, service_fee, delivery_fee, tip, discount, total,
               order_status, placed_at
        FROM guest_orders
        ORDER BY placed_at DESC
      `),
      pool.query(`
        SELECT
          COUNT(*)::int                                                                AS total_orders,
          COALESCE(SUM(total) FILTER (WHERE order_status IN ('delivered','completed')),0)::numeric AS total_revenue,
          COALESCE(AVG(total) FILTER (WHERE order_status IN ('delivered','completed')),0)::numeric AS avg_order_value,
          COUNT(*) FILTER (WHERE order_status = 'pending')::int                         AS pending,
          COUNT(*) FILTER (WHERE order_status IN ('delivered','completed'))::int        AS completed,
          COUNT(*) FILTER (WHERE order_status = 'cancelled')::int                       AS cancelled
        FROM guest_orders
      `),
      pool.query(`
        SELECT payment_method,
               COUNT(*)::int            AS count,
               COALESCE(SUM(total), 0)::numeric AS revenue
        FROM guest_orders
        WHERE payment_method IS NOT NULL AND payment_method != ''
          AND order_status IN ('delivered','completed')
        GROUP BY payment_method
        ORDER BY revenue DESC
      `),
      // Charges made through the "Make a Payment" page — separate from
      // regular order checkout, e.g. catering deposits, wholesale invoices.
      pool.query(`
        SELECT id, order_number, amount, reason, note, customer_name,
               customer_phone, transaction_id, created_at
        FROM quick_payments
        ORDER BY created_at DESC
        LIMIT 200
      `),
    ]);
    res.json({
      transactions:    rows.rows,
      stats:           stats.rows[0],
      by_method:       byMethod.rows,
      quick_payments:  quickPayments.rows,
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// Refund
const { refundOrder } = require("../controllers/paymentController");
router.post("/payments/:orderNumber/refund", refundOrder);

// Sold-out item waitlist — pending-signup counts for the Inventory page's "N waiting" badge
const { getWaitlistCounts } = require("../controllers/waitlistController");
router.get("/waitlist/counts", getWaitlistCounts);

// Payment Method Settings (enable/disable)
const { getAdminPaymentSettings, updatePaymentSetting, updateOfflineHandles, getOfflineHandles, getIntegrationStatus, updateSystemSettings } = require("../controllers/settingsController");
router.get("/payment-settings", getAdminPaymentSettings);
router.get("/payment-settings/offline-handles", getOfflineHandles);
router.patch("/payment-settings/offline-handles", updateOfflineHandles);
router.patch("/payment-settings/:id", updatePaymentSetting);
router.get("/integration-status", getIntegrationStatus);
router.patch("/settings/checkout", updateSystemSettings);

// Coupons
const couponRoutes = require("./couponRoutes");
router.use("/coupons", couponRoutes);

// Coupon usage stats
router.get("/coupon-stats", getCouponStats);

// Location Management
const { createLocation, deleteLocation } = require("../controllers/locationController");
router.get("/locations", getAdminLocations);
router.post("/locations", createLocation);
router.put("/locations/:id", updateAdminLocation);
router.patch("/locations/:id/toggle", toggleLocation);
router.delete("/locations/:id", deleteLocation);

// (Menu availability route is registered before /:id above)

// Staff
const { getStaff, createStaff, updateStaff, deleteStaff, bulkImportStaff, bulkDeleteStaff, bulkSetStaffStatus } = require("../controllers/staffController");
const staffValidation = [
  body('name').notEmpty().withMessage('Name is required.').isLength({ max: 100 }).withMessage('Name too long.').trim(),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email.').normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).isLength({ max: 30 }).withMessage('Phone too long.').trim(),
  body('role').optional({ checkFalsy: true }).isLength({ max: 50 }).withMessage('Role too long.').trim(),
  body('notes').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('Notes too long.').trim(),
  handleValidation,
];
router.get("/staff", getStaff);
router.post("/staff", staffValidation, createStaff);
router.put("/staff/:id", staffValidation, updateStaff);
router.delete("/staff/:id", deleteStaff);
router.post("/staff/bulk-import", bulkImportStaff);
router.post("/staff/bulk-delete", bulkDeleteStaff);
router.patch("/staff/bulk-status", bulkSetStaffStatus);

// Inventory
const {
  getInventory, createItem, updateItem, deleteItem, restockItem, getRestockLog, getOrderLog
} = require("../controllers/inventoryController");
router.get("/inventory", getInventory);
router.get("/inventory/restock-log", getRestockLog);
router.get("/inventory/order-log", getOrderLog);
router.post("/inventory", createItem);
router.put("/inventory/:id", updateItem);
router.delete("/inventory/:id", deleteItem);
router.post("/inventory/:id/restock", restockItem);

// Delivery Zones
const { getZones, createZone, updateZone, deleteZone } = require("../controllers/zonesController");
router.get("/zones", getZones);
router.post("/zones", createZone);
router.put("/zones/:id", updateZone);
router.delete("/zones/:id", deleteZone);

// Partner Orders (B2B)
const emailService = require("../services/emailService");

router.get("/partner-orders", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT po.*, u.email AS partner_email
      FROM partner_orders po
      LEFT JOIN users u ON u.id = po.partner_user_id
      ORDER BY po.placed_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

router.patch("/partner-orders/:id/status", async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending','confirmed','processing','shipped','delivered','cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  try {
    const result = await pool.query(
      `UPDATE partner_orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Order not found' });
    const order = result.rows[0];

    if (status !== 'pending') {
      try {
        const partnerResult = await pool.query(
          `SELECT u.email, pa.business_name
           FROM users u
           LEFT JOIN partner_applications pa ON pa.id = u.partner_id
           WHERE u.id = $1`,
          [order.partner_user_id]
        );
        const partner = partnerResult.rows[0];
        if (partner?.email) {
          let items = [];
          try { items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]'); } catch (_) {}
          emailService.sendPartnerOrderUpdate(
            partner.email,
            partner.business_name || 'Partner',
            order.order_number,
            status,
            items,
            order.total
          ).catch(err => console.error('[PartnerEmail] Order update failed:', err.message));
        }
      } catch (emailErr) {
        console.error('[PartnerEmail] Lookup failed:', emailErr.message);
      }
    }

    res.json(order);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// Admin-verified payment confirmation (e.g. a Net 30 check or bank transfer came in).
// There is no partner-side self-service "pay" endpoint — a partner marking their own
// invoice paid with no real charge behind it would be a billing-integrity hole.
router.patch("/partner-orders/:id/payment", async (req, res) => {
  const { payment_status } = req.body;
  const allowed = ['unpaid', 'paid', 'refunded'];
  if (!allowed.includes(payment_status)) return res.status(400).json({ message: 'Invalid payment status' });
  try {
    const result = await pool.query(
      `UPDATE partner_orders SET payment_status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [payment_status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// Careers
const {
  getAdminVacancies, createVacancy, updateVacancy, deleteVacancy,
  getApplications, updateApplicationStatus: updateJobAppStatus,
} = require("../controllers/careersController");
router.get("/careers/vacancies",                  getAdminVacancies);
router.post("/careers/vacancies",                 createVacancy);
router.patch("/careers/vacancies/:id",            updateVacancy);
router.delete("/careers/vacancies/:id",           deleteVacancy);
router.get("/careers/applications",               getApplications);
router.patch("/careers/applications/:id/status",  updateJobAppStatus);

// Broadcasts
const { getBroadcasts, sendBroadcast, deleteBroadcast, sendTestBroadcast, getRecipientCount, uploadBroadcastImage } = require("../controllers/broadcastsController");
router.get("/broadcasts", getBroadcasts);
router.post("/broadcasts", sendBroadcast);
router.post("/broadcasts/test", sendTestBroadcast);
router.get("/broadcasts/recipient-count", getRecipientCount);
router.post("/broadcasts/upload-image", upload.single("image"), uploadBroadcastImage);
router.delete("/broadcasts/:id", deleteBroadcast);

// Platform Integrations (Milestone 2)
const { getPlatformSettings, updatePlatformSettings, triggerCatalogSync } = require("../controllers/integrationsController");
router.get("/integrations",              getPlatformSettings);
router.post("/integrations/sync",        triggerCatalogSync);
router.patch("/integrations/:platform",  updatePlatformSettings);

// Platform Credentials & Location Mappings
const {
  getCredentials, updateCredentials,
  getLocationMappings, upsertLocationMapping,
  triggerMenuSync, getMenuPreviewForPlatform,
} = require("../controllers/platformCredentialsController");
router.get("/credentials",                       getCredentials);
router.patch("/credentials/:platform",           updateCredentials);
router.get("/location-mappings",                 getLocationMappings);
router.post("/location-mappings",                upsertLocationMapping);
router.post("/menu-sync",                        triggerMenuSync);
router.get("/menu-preview/:platform",            getMenuPreviewForPlatform);

// Reviews Moderation
const { getAdminReviews, updateReview, deleteReview } = require("../controllers/reviewsController");
router.get("/reviews",        getAdminReviews);
router.patch("/reviews/:id",  updateReview);
router.delete("/reviews/:id", deleteReview);

// Audit Log
const { getAuditLog } = require("../controllers/auditController");
router.get("/audit-log", getAuditLog);

// Reports (extended)
const {
  getRevenueReport, getTransactionReport, getRevenueByLocation,
  getRevenueByCategory, getTaxReport, getOrderReport, getCouponUsageReport
} = require("../controllers/reportsController");
router.get("/reports/revenue",      getRevenueReport);
router.get("/reports/transactions", getTransactionReport);
router.get("/reports/by-location",  getRevenueByLocation);
router.get("/reports/by-category",  getRevenueByCategory);
router.get("/reports/tax",          getTaxReport);
router.get("/reports/orders",       getOrderReport);
router.get("/reports/coupon-usage", getCouponUsageReport);

// Chat Inbox
router.get("/chat",                       getChatConversations);
router.get("/chat/:order_number",         getChatMessages);
router.post("/chat/:order_number",        sendAdminChatMessage);

// Loyalty Program
router.get("/loyalty/stats",             getLoyaltyStats);
router.get("/loyalty/customers",         getLoyaltyCustomers);
router.post("/loyalty/adjust",           adjustLoyaltyPoints);
router.get("/loyalty/config",            getLoyaltyConfig);
router.put("/loyalty/config",            updateLoyaltyConfig);
router.get("/loyalty/tiers",             getLoyaltyTiers);
router.put("/loyalty/tiers",             updateLoyaltyTiers);

// Business Hours
const { getBusinessHours, saveBusinessHours } = require('../controllers/businessHoursController');
router.get('/business-hours', getBusinessHours);
router.put('/business-hours', saveBusinessHours);

// Change admin password
router.post('/change-password',
  body('current_password').notEmpty().withMessage('Current password is required.'),
  body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
  handleValidation,
  changeAdminPassword
);

// ── Referral Program — admin read-only ───────────────────────────────────
router.get('/referrals', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.referral_code, r.status, r.points_awarded, r.created_at, r.completed_at,
             r.referee_email,
             u1.name  AS referrer_name,  u1.email AS referrer_email,
             u2.name  AS referee_name
        FROM referrals r
        LEFT JOIN users u1 ON u1.id = r.referrer_id
        LEFT JOIN users u2 ON u2.id = r.referee_user_id
       ORDER BY r.created_at DESC
       LIMIT 500
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// ── Group Orders — admin read-only ────────────────────────────────────────
router.get('/group-orders', async (req, res) => {
  try {
    // Participants and items must be aggregated independently before joining —
    // joining both directly on session_id fans out N participants × M items,
    // inflating item_count/total_value by a factor of the participant count.
    const result = await pool.query(`
      SELECT gs.session_id, gs.join_code, gs.host_name, gs.status, gs.expires_at, gs.created_at,
             u.email AS host_email,
             COALESCE(pc.participant_count, 0) AS participant_count,
             COALESCE(ic.item_count, 0)        AS item_count,
             COALESCE(ic.total_value, 0)       AS total_value
        FROM group_order_sessions gs
        LEFT JOIN users u ON u.id = gs.host_user_id
        LEFT JOIN (
          SELECT session_id, COUNT(*) AS participant_count
            FROM group_order_participants
           GROUP BY session_id
        ) pc ON pc.session_id = gs.session_id
        LEFT JOIN (
          SELECT session_id, COUNT(*) AS item_count, SUM(price * qty) AS total_value
            FROM group_order_items
           GROUP BY session_id
        ) ic ON ic.session_id = gs.session_id
       ORDER BY gs.created_at DESC
       LIMIT 500
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});

// ── Saved Custom Orders — admin view + moderation delete ─────────────────
const { deleteSavedCustomAdmin } = require("../controllers/savedCustomController");
router.get('/saved-customs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sc.id, sc.name, sc.config, sc.created_at,
             u.id    AS user_id,
             u.name  AS user_name,
             u.email AS user_email
        FROM saved_custom_orders sc
        JOIN users u ON u.id = sc.user_id
       ORDER BY sc.created_at DESC
       LIMIT 1000
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(safeError(err));
  }
});
router.delete('/saved-customs/:id', deleteSavedCustomAdmin);

// ── Authorize.net merchant accounts ──────────────────────────────────────
const {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  setActiveAccount,
} = require('../controllers/authNetController');
router.get("/authnet/accounts",            listAccounts);
router.post("/authnet/accounts",           createAccount);
router.put("/authnet/accounts/:id",        updateAccount);
router.delete("/authnet/accounts/:id",     deleteAccount);
router.post("/authnet/accounts/:id/activate", setActiveAccount);

// ── Square / Clover merchant accounts ────────────────────────────────────
const {
  listAccounts:  listCardProcessorAccounts,
  createAccount: createCardProcessorAccount,
  updateAccount: updateCardProcessorAccount,
  deleteAccount: deleteCardProcessorAccount,
  setActiveAccount: setActiveCardProcessorAccount,
} = require('../controllers/cardProcessorController');
router.get("/card-processors/accounts",              listCardProcessorAccounts);
router.post("/card-processors/accounts",              createCardProcessorAccount);
router.put("/card-processors/accounts/:id",           updateCardProcessorAccount);
router.delete("/card-processors/accounts/:id",         deleteCardProcessorAccount);
router.post("/card-processors/accounts/:id/activate", setActiveCardProcessorAccount);


module.exports = router;