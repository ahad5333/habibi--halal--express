const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const protect = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const { handleValidation, body } = require('../middleware/validate');
const safeError = require('../utils/safeError');
const {
  getDashboardStats,
  getAllOrders,
  getAllMenus,
  updateOrderStatus,
  getSidebarItems,
  getAllCustomers,
  getCustomerDetails,
  getDeliveryTiers,
  updateDeliveryTier,
  updateOrderProvider,
  getAdminLocations,
  updateAdminLocation,
  toggleLocation,
  toggleMenuAvailability,
  getLocationMenuAvailability,
  setLocationMenuAvailability,
  getCouponStats,
} = require("../controllers/adminController");
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

// Protect all admin routes with both Auth and Admin middleware
router.use(protect);
router.use(admin);

// Sidebar items
router.get("/sidebar", getSidebarItems);

// Analytics & Stats
router.get("/stats", getDashboardStats);
router.get("/analytics/revenue", getRevenueAnalytics);
router.get("/analytics/growth", getCustomerGrowth);

// Global Orders
router.get("/orders", getAllOrders);
router.patch("/orders/:id/status", updateOrderStatus);
router.patch("/orders/:id/provider", updateOrderProvider);

// Customers
router.get("/customers", getAllCustomers);
router.get("/customers/:id", getCustomerDetails);

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
const { getBusinessMenus, createBusinessMenu, updateBusinessMenu, deleteBusinessMenu } = require("../controllers/businessMenuController");
const upload = require("../middleware/uploadMiddleware");

router.get("/menus", getAllMenus);
router.patch("/menus/availability", toggleMenuAvailability);
router.get("/menus/location-availability", getLocationMenuAvailability);
router.post("/menus/location-availability", setLocationMenuAvailability);
router.post("/menus", upload.single("image"), createMenu);
router.patch("/menus/:id", upload.single("image"), updateMenu);
router.delete("/menus/:id", deleteMenu);

// Business Menus
router.get("/business-menus", getBusinessMenus);
router.post("/business-menus", upload.single("image"), createBusinessMenu);
router.patch("/business-menus/:id", upload.single("image"), updateBusinessMenu);
router.delete("/business-menus/:id", deleteBusinessMenu);

// Payments (standalone)
router.get("/payments", async (req, res) => {
  try {
    const [rows, stats, byMethod] = await Promise.all([
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
          COUNT(*)::int                         AS total_orders,
          COALESCE(SUM(total), 0)::numeric      AS total_revenue,
          COALESCE(AVG(total), 0)::numeric      AS avg_order_value,
          COUNT(*) FILTER (WHERE order_status = 'pending')::int    AS pending,
          COUNT(*) FILTER (WHERE order_status = 'completed')::int  AS completed,
          COUNT(*) FILTER (WHERE order_status = 'cancelled')::int  AS cancelled
        FROM guest_orders
      `),
      pool.query(`
        SELECT payment_method,
               COUNT(*)::int            AS count,
               COALESCE(SUM(total), 0)::numeric AS revenue
        FROM guest_orders
        WHERE payment_method IS NOT NULL AND payment_method != ''
        GROUP BY payment_method
        ORDER BY revenue DESC
      `),
    ]);
    res.json({
      transactions: rows.rows,
      stats:        stats.rows[0],
      by_method:    byMethod.rows,
    });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// Refund
const { refundOrder } = require("../controllers/paymentController");
router.post("/payments/:orderNumber/refund", refundOrder);

// Payment Method Settings (enable/disable)
const { getAdminPaymentSettings, updatePaymentSetting } = require("../controllers/settingsController");
router.get("/payment-settings", getAdminPaymentSettings);
router.patch("/payment-settings/:id", updatePaymentSetting);

// Coupons
const couponRoutes = require("./couponRoutes");
router.use("/coupons", couponRoutes);

// Coupon usage stats
router.get("/coupon-stats", getCouponStats);

// Location Management
router.get("/locations", getAdminLocations);
router.put("/locations/:id", updateAdminLocation);
router.patch("/locations/:id/toggle", toggleLocation);

// (Menu availability route is registered before /:id above)

// Staff
const { getStaff, createStaff, updateStaff, deleteStaff } = require("../controllers/staffController");
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

// Inventory
const {
  getInventory, createItem, updateItem, deleteItem, restockItem, getRestockLog
} = require("../controllers/inventoryController");
router.get("/inventory", getInventory);
router.get("/inventory/restock-log", getRestockLog);
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
const { getBroadcasts, sendBroadcast, deleteBroadcast } = require("../controllers/broadcastsController");
router.get("/broadcasts", getBroadcasts);
router.post("/broadcasts", sendBroadcast);
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

module.exports = router;

