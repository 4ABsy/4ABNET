# 4AB NET — Complete Full-Stack eSIM E-Commerce Platform

## 1. Project Overview

Build a complete, production-oriented, full-stack e-commerce platform named **4AB NET** for selling digital eSIM internet packages.

**Brand name:** 4AB NET  
**Brand tagline:** إنترنت بضغطة زر  
**Primary brand color:** `#FA8F40`  
**Initial currency:** Turkish Lira (TRY / ₺)  
**Supported languages:** Arabic, English, and Turkish  
**Primary audience:** Customers purchasing digital eSIM internet packages.

The platform must include:----

1. A complete e-commerce website.
2. A responsive customer storefront.
3. A shopping cart and checkout system.
4. Manual bank transfer payment and receipt submission.
5. Manual eSIM inventory management and secure delivery.
6. A comprehensive administration dashboard.
7. Multiple administrative accounts with role-based permissions.
8. Complete Arabic, English, and Turkish localization.
9. A Telegram bot integrated with a Telegram Mini App.
10. An installable Progressive Web App (PWA).
11. A persistent database, secure APIs, and server-side business logic.
12. Deployment, testing, backup, and maintenance documentation.

The design should be modern, premium, responsive, and mobile-first. Take inspiration from the usability and organization of leading e-commerce platforms such as Salla, without copying their branding, proprietary interface, or assets.

This must be a real, functional application, not a static prototype.

Every visible interactive element must work. Products, prices, inventory, orders, settings, permissions, language preferences, and order statuses must be backed by real database records and server-side logic.

Do not replace real functionality with mock data or simulated integrations unless explicitly identified as development-only functionality.

---

## 2. First: Inspect, Plan, and Design the Architecture

Before writing substantial application code:

1. Inspect the available development environment.
2. Identify the supported frameworks, database integrations, storage services, hosting options, and deployment workflow.
3. Recommend an appropriate technology stack.
4. Prefer Next.js, TypeScript, Tailwind CSS, and PostgreSQL when supported and appropriate.
5. Define the database schema, API architecture, authentication model, permissions system, Telegram integration, file storage strategy, and localization approach.
6. Identify all required external services, API keys, environment variables, and credentials.
7. Prepare an implementation plan divided into clear phases.
8. Define acceptance criteria for every phase.
9. Identify architectural limitations and explain any necessary compromises before implementing them.

Build a coherent application with reusable components, persistent storage, server-side validation, and a clear separation between public, customer, and administrative functionality.

Do not expose secrets or privileged operations to the browser.

Do not invent credentials or claim that a service is connected when it has not been configured.

---

## 3. Brand Identity and UI/UX

Create a professional, polished storefront for 4AB NET.

### Visual identity

- Primary color: `#FA8F40`.
- Supporting colors: white, charcoal, and subtle neutral backgrounds.
- Modern typography suitable for Arabic, English, and Turkish.
- Consistent spacing, typography, buttons, cards, icons, and form controls.
- Clear visual hierarchy.
- Accessible contrast and visible keyboard focus states.
- Professional loading, success, empty, error, and offline states.
- Responsive layouts for mobile, tablet, and desktop.
- Consistent design across the storefront, checkout, order tracking, and administration dashboard.

The interface should feel trustworthy, fast, and easy to use.

Avoid excessive animations, unnecessary visual clutter, and inconsistent design patterns.

Create a shared design system with reusable components and centralized design tokens.

### Responsive behavior

The entire platform must work properly on:

- Mobile phones.
- Tablets.
- Desktop computers.
- Supported mobile browsers.
- Telegram Mini App environments.
- Supported standalone PWA installations.

Do not focus only on the homepage. Apply the same design quality to every page and workflow.

---

## 4. Complete Multilingual Support

**Arabic, English, and Turkish are mandatory application languages, not optional future enhancements.**

Implement localization throughout the entire application.

### 4.1 Supported languages

The initial supported languages are:

- Arabic (`ar`) — default language.
- English (`en`).
- Turkish (`tr`).

Build the localization architecture so additional languages can be introduced later without rewriting the application.

### 4.2 Language selector

Create a visible, professional language selector in the storefront header and an appropriate language selector in the administration interface.

The selector must allow users to switch between Arabic, English, and Turkish.

Requirements:

- Arabic is the default language for first-time visitors unless a different preference is deliberately selected or reliably detected.
- Detect the browser's preferred language when appropriate.
- Do not override a language explicitly selected by the user.
- Persist the selected language using an appropriate mechanism.
- Keep the selected language consistent when navigating between pages.
- Preserve the selected language through the shopping cart and checkout.
- Support direct links to localized pages.
- Handle invalid or unavailable language codes safely.
- Provide a sensible fallback for missing translations.

### 4.3 Correct text direction

Implement proper text direction throughout the application.

**Arabic:**
- Right-to-left layout (`RTL`).
- Appropriate Arabic typography.
- Correct alignment, spacing, icons, and navigation behavior.
- Properly arranged forms, tables, dropdowns, modals, and administrative sidebars.

**English and Turkish:**
- Left-to-right layout (`LTR`).
- Appropriate typography and natural text alignment.
- Correctly arranged navigation, forms, tables, and interface controls.

Do not simply reverse text alignment. Implement correct direction-aware layouts using suitable CSS logical properties and localization-aware components.

Avoid broken mixed-direction text when displaying phone numbers, order references, prices, activation codes, and other technical values.

### 4.4 Complete translation coverage

Translate every user-facing interface element into all three languages.

This includes:

- Navigation.
- Buttons.
- Page titles.
- Headings.
- Product labels.
- Category labels.
- Product search.
- Search results.
- Filters and sorting.
- Product details.
- Shopping cart.
- Checkout.
- Form labels and validation messages.
- Payment instructions.
- Payment status.
- Order tracking.
- Order history.
- Success and error messages.
- Notifications.
- Confirmation dialogs.
- Empty states.
- Loading states.
- Offline messages.
- Privacy policy.
- Terms and conditions.
- Refund and cancellation policies.
- Customer support information.
- Footer links.
- Telegram bot messages.
- Telegram Mini App interface.
- Administrative dashboard.
- Administrative forms.
- Inventory management.
- Order management.
- User management.
- Settings.
- Reports and statistics.
- Permission-denied messages.

Do not leave untranslated interface text scattered throughout the code.

Use a centralized translation system with organized translation files or an equivalent maintainable architecture.

### 4.5 Localized database content

Product names, descriptions, categories, banners, and other editable content must support Arabic, English, and Turkish.

Administrators must be able to manage the translations of this content from the administration dashboard.

For example, a product may contain:

- Arabic name and description.
- English name and description.
- Turkish name and description.

Apply the same principle to categories, promotional banners, and other content intended for customers in multiple languages.

Use an appropriate database structure, such as related translation tables or structured localized fields, based on the selected architecture.

Requirements:

- Do not hardcode product translations into frontend components.
- Do not assume that translating the interface automatically translates the catalog.
- Provide clear translation fields in administrative forms.
- Allow administrators to save a product even when some translations are missing, if the application supports a defined fallback policy.
- Display the best available translation according to the user's selected language and the configured fallback rules.
- Make missing translations visible to administrators.
- Preserve the original content and all other language versions when one translation is edited.

### 4.6 Language-aware formatting

Use localization-aware formatting for:

- Prices.
- Dates.
- Times.
- Numbers.
- Validation messages.
- Order information.

Turkish Lira remains the initial store currency regardless of the selected language.

Changing the language must not automatically change the currency or modify the underlying price.

Display the currency in a natural and consistent format for each language.

### 4.7 Telegram localization

The Telegram bot and Mini App must respect the user's selected language whenever possible.

- Use Arabic, English, or Turkish for customer-facing messages.
- Detect the Telegram user's language when appropriate.
- Allow an explicit language selection.
- Keep language preferences consistent between the bot and Mini App where possible.
- Send order status notifications in the customer's selected language.
- Provide translated button labels and error messages.
- Use a clear fallback language when a translation is unavailable.

### 4.8 Localization acceptance tests

Test the following:

- Switching between all three languages.
- Correct Arabic RTL behavior.
- Correct English and Turkish LTR behavior.
- Language persistence across navigation and refreshes.
- Correct localized product and category content.
- Checkout in each language.
- Localized order tracking.
- Localized validation and error messages.
- Localized Telegram notifications.
- Missing-translation fallback behavior.
- Mobile layout in all three languages.

The project is not complete if only the homepage supports the three languages.

---

## 5. Storefront and Homepage

Build a polished, database-driven homepage.

Include the following sections:

1. An editable announcement bar displaying the default Arabic message:

   "ابقى على تواصل مع من تحب بدون انقطاع"

   Allow administrators to provide localized versions in English and Turkish.

2. A header containing:
   - Store logo.
   - 4AB NET brand name.
   - Product search.
   - Shopping cart icon.
   - Cart item count.
   - Language selector.
   - Responsive navigation.

3. A mobile navigation drawer with categories and important links.

4. An automatically rotating promotional banner carousel.

5. A "Shop by Category" section, localized into the selected language.

6. A features section highlighting:
   - Digital delivery.
   - Clear package information.
   - Activation guidance.
   - Reliable and transparent purchasing.

7. An offers and discounts section.

8. Product sections grouped by category.

9. A complete footer containing:
   - Category links.
   - Customer support information.
   - Policies.
   - Contact information.
   - Available payment methods.
   - Language selection where appropriate.

All production banners, categories, and displayed products must come from the database.

Do not hardcode the production catalog into the frontend.

### Homepage administration

Authorized administrators must be able to manage:

- Announcement text in all supported languages.
- Banner images and localized text.
- Banner destinations.
- Categories displayed on the homepage.
- Featured products.
- Offers and discounts.
- Section visibility.
- Display order.
- Relevant homepage settings.

Changes should appear on the website without requiring a code change or application redeployment.

---

## 6. Product Cards and Product Details

### Product cards

Each card must support:

- Product image.
- Localized product name.
- Localized short description.
- Current price in Turkish Lira.
- Original price with strikethrough when discounted.
- Discount percentage badge.
- Availability status.
- Add-to-cart button.
- Clear confirmation after adding an item.
- Appropriate loading and error states.

### Product details

Each product page must include:

- Product image gallery.
- Localized product name.
- Localized description.
- Supported countries or regions.
- Data allowance.
- Package validity.
- Network information.
- Activation requirements.
- Current and original prices.
- Calculated savings.
- Availability status.
- Quantity controls where appropriate.
- Add-to-cart action.
- Buy-now action.
- Related products.

Package specifications must be configurable by authorized administrators.

Never invent technical specifications for an eSIM package.

Clearly distinguish between verified package details and information that has not yet been provided.

### Product search

Implement working product search using appropriate database-backed functionality.

Search should support the active language and relevant product fields.

Provide sensible handling for:

- No results.
- Invalid input.
- Empty searches.
- Slow responses.
- Search errors.

---

## 7. Shopping Cart and Checkout

All products are digital, so shipping fees are not required.

Create a clear, mobile-friendly checkout flow.

### Step 1: Customer information

Collect the minimum information needed to process the order, such as:

- Customer name.
- Phone number.

Allow ordinary website customers to purchase without requiring a Telegram account.

Validate customer information on the server.

### Step 2: Payment method

Support configurable payment methods.

**Bank transfer:**

- Display administrator-configured bank details.
- Show payment instructions in the selected language.
- Allow customers to upload a payment receipt.
- Store the receipt securely.
- Display a clear message that the payment is awaiting verification.

An uploaded receipt is not proof that the payment was completed.

**Cash on delivery:**

- Optional.
- Disabled by default.
- Enable only if the administrator explicitly configures a suitable workflow for this digital-product business.

Do not activate unsupported payment methods or pretend that online payment processing exists when it has not been implemented.

### Step 3: Review and confirm

Show:

- Customer information.
- Selected products.
- Quantities.
- Subtotals.
- Discounts.
- Final total.
- Selected payment method.
- Applicable payment instructions.

Calculate prices, discounts, and totals on the server using trusted database values.

Never trust prices or totals submitted by the browser.

### Checkout safeguards

- Validate product availability.
- Validate quantities.
- Validate the selected payment method.
- Prevent duplicate submissions.
- Prevent accidental duplicate orders.
- Use database transactions where appropriate.
- Recalculate totals on the server.
- Preserve order prices as historical snapshots.
- Do not assign or deliver eSIM inventory before the required approval conditions are met.

Create an order confirmation page containing:

- A unique order reference.
- Order summary.
- Payment status.
- Order status.
- A secure way to track the order.

All checkout text and validation messages must be available in Arabic, English, and Turkish.

---

## 8. Manual eSIM Inventory Management and Delivery

The initial version must use manual inventory management.

**Do not require an external eSIM supplier API.**

Authorized administrators will add and manage the available eSIM packages manually.

### Inventory records

Each inventory record must support:

- Associated product.
- Activation instructions.
- QR image or delivery asset, when applicable.
- Activation code, when applicable.
- Other required private delivery details.
- Inventory status.
- Associated order.
- Assignment date.
- Delivery date.
- Relevant administrative history.

Supported inventory states:

- Available.
- Reserved.
- Assigned.
- Revoked.

The inventory system must support multiple available eSIM units for the same product.

### Secure inventory assignment

Inventory assignment must be atomic and transaction-safe.

Two concurrent orders must never receive the same inventory unit.

Use appropriate database transactions, locking, uniqueness constraints, or equivalent safeguards.

Handle reservation expiration and abandoned orders according to a documented policy.

Only assign and deliver inventory after the configured payment and order approval requirements have been satisfied.

### Manual delivery workflow

Authorized administrators must be able to:

1. Open an approved order.
2. Review its products and payment status.
3. Assign an appropriate available eSIM unit.
4. Review the delivery information.
5. Deliver the eSIM securely to the intended customer.
6. Mark the order as delivered.
7. Record the delivery event in the audit history.

Provide a secure customer delivery page or another appropriately protected delivery mechanism.

Do not expose activation codes, QR assets, or private inventory records through public product APIs.

Never include activation codes, QR images, or private delivery details in Telegram order notifications.

Do not place sensitive delivery details in URLs, public logs, or browser-accessible administrative APIs without appropriate authorization.

---

## 9. Order Management and Customer Tracking

Implement persistent order records with unique, non-sequential public order references.

Support explicitly defined order statuses, including:

- Awaiting confirmation.
- Awaiting payment.
- Payment under review.
- Confirmed.
- Processing.
- Delivered.
- Cancelled.
- Refunded, if refund handling is implemented.

Define permitted status transitions and enforce them on the server.

Record status changes with timestamps and the responsible administrator or system process.

### Administrative order management

Authorized administrators must be able to:

- View order details.
- Search by order reference.
- Filter by order status.
- Filter by date.
- Review customer information.
- Review payment information.
- Access uploaded receipts securely.
- Contact customers through a WhatsApp link.
- Confirm or cancel orders.
- Update processing status.
- Assign eSIM inventory.
- Record delivery.
- Review order history.
- Review relevant administrative actions.

### Customer order tracking

Customers must only be able to access their own orders through an appropriate identity verification or protected order-tracking mechanism.

Do not expose private orders through sequential numeric IDs.

Protect customer information, receipts, and digital delivery information from unauthorized access.

Provide localized order status descriptions in all three supported languages.

---

## 10. Telegram Bot and Mini App

Integrate the platform with the official Telegram Bot API.

The application must operate as both:

1. A standard website.
2. A Telegram Mini App launched from a Telegram bot.

### Customer experience

Implement:

- A bot start message.
- An "Open Store" button.
- A working storefront inside Telegram.
- Secure Telegram Mini App initialization-data verification on the server.
- Appropriate identity linking.
- Optional customer Telegram linking.
- A "Track Your Order on Telegram" option when the customer has linked or verified their Telegram identity.

Never trust Telegram usernames, IDs, or client-provided initialization data without server-side verification.

Request contact information only when necessary and with explicit user action.

Do not assume Telegram automatically provides a customer's phone number or physical address.

Ordinary website customers must be able to check out without a Telegram account.

### Administrator order notifications

When a new order is created, send a notification to the configured administrative Telegram chat.

Include:

- Order reference.
- Customer name and phone, when provided.
- Product names.
- Quantities.
- Order total.
- Payment method.
- Payment status.
- A secure reference for administrative actions.

Provide localized administrative button labels where appropriate.

Implement buttons for:

- Confirm order.
- Cancel order.

Every button action must verify the administrator's identity and permissions on the server.

Actions must be idempotent and protected against unauthorized use.

A Telegram callback is not proof of payment.

### Customer notifications

Send relevant order status notifications when a verified Telegram conversation is available and messaging is permitted.

Notifications must use the customer's preferred language.

Handle:

- API errors.
- Retries.
- Rate limits.
- Failed notifications.
- Temporary service interruptions.

A Telegram failure must never lose or corrupt the underlying order.

Do not assume a customer can receive a message until the customer has initiated the bot or otherwise made messaging possible under Telegram's rules.

### Administrative access from Telegram

Provide a secure way for authorized administrators to access the administration panel.

Use a secure authenticated flow or short-lived, single-use login links when appropriate.

Never treat possession of a permanent URL as the sole administrative security control.

---

## 11. Multi-Administrator System and Permissions

**This requirement is mandatory: the store owner must be able to add another administrator who can help manage the website.**

Build a secure multi-administrator system with server-side role-based access control.

Do not implement an unrestricted public administrator registration page.

### 11.1 Owner role

The initial owner account is the highest-privilege account.

The owner must be able to:

- Access the entire administration dashboard.
- Manage products.
- Manage categories.
- Manage promotional banners.
- Manage inventory.
- Review and approve payments.
- Manage orders and delivery.
- View reports and statistics.
- Configure store settings.
- Configure Telegram integration.
- Manage administrative users.
- Assign and revoke administrative permissions.
- Review audit logs.
- Disable or remove additional administrators.
- Manage administrative access and security settings.

The initial owner account must be created through a secure setup process.

Do not hardcode the owner's credentials.

Do not expose the initial administrator setup process publicly after setup is complete.

### 11.2 Additional administrator role

The owner must be able to invite or create an additional administrator from the administration dashboard.

Provide a dedicated section named "Administrators" or "User Management".

The interface should allow the owner to:

- Add an administrator.
- Enter the administrator's name.
- Enter the administrator's email address or another supported login identifier.
- Send a secure invitation or initiate a secure account creation process.
- View the invitation status.
- View the administrator's account status.
- Assign permissions.
- Modify permissions.
- Suspend access.
- Revoke access.
- Review that administrator's relevant actions.

Use the selected authentication provider's supported invitation flow where appropriate.

Invitations must expire and must not be reusable after successful acceptance.

Do not allow administrators to choose or view another user's password.

### 11.3 Role-based permissions

Implement permissions on the server, not merely by hiding buttons in the interface.

At minimum, support these roles:

**Owner**
- Full control over the application.
- Can manage additional administrators.
- Can grant and revoke permissions.
- Can modify critical security settings.

**Administrator**
- Can access the administrative features explicitly granted by the owner.
- Cannot automatically gain owner privileges.
- Cannot create another owner.
- Cannot change ownership.
- Cannot modify critical security settings unless explicitly authorized.
- Cannot grant themselves additional permissions.
- Cannot bypass server-side authorization.

Support granular permissions where appropriate, including:

- View dashboard.
- View orders.
- Update orders.
- Confirm or cancel orders.
- Review payments.
- View payment receipts.
- Manage products.
- Manage categories.
- Manage banners.
- Manage eSIM inventory.
- Assign and deliver eSIMs.
- View customer information.
- Manage store content.
- Manage language translations.
- View reports.
- Manage store settings.
- Manage Telegram settings.
- View audit logs.
- Manage administrators.

Sensitive permissions, especially access to private delivery information and administrator management, must be restricted carefully.

The owner must remain in control of the permission system.

### 11.4 Administrative authentication and authorization

Use secure authentication and session management.

Requirements:

- Authenticate every administrative session.
- Enforce authorization on every privileged server operation.
- Verify permissions on API endpoints and server actions.
- Protect administrative routes.
- Expire and revoke sessions appropriately.
- Apply rate limits to authentication endpoints.
- Prevent privilege escalation.
- Prevent unauthorized role changes.
- Do not rely solely on client-side role information.
- Do not trust role names or permissions submitted by the browser.
- Require appropriate confirmation for sensitive actions.

Where supported, recommend multi-factor authentication for the owner and other privileged administrators.

### 11.5 Audit logs

Maintain a persistent audit trail for important administrative actions.

Record:

- Acting administrator.
- Action performed.
- Affected resource.
- Timestamp.
- Relevant non-sensitive change details.
- Success or failure when appropriate.

Audit important operations such as:

- Order approval and cancellation.
- Payment verification.
- Inventory assignment.
- eSIM delivery.
- Product and price changes.
- Store settings changes.
- Permission changes.
- Administrator invitations.
- Administrator suspension or removal.

Do not record passwords, session secrets, full activation credentials, or other sensitive secrets in audit logs.

Restrict audit-log access according to permissions.

### 11.6 Telegram administrator permissions

The Telegram integration must respect the same administrative authorization rules.

A Telegram user must not be able to approve orders or perform privileged actions merely because they know the bot or administrative chat.

Verify the Telegram identity and its mapping to an authorized administrative account.

Check the required permission for every Telegram callback on the server.

Do not use a single shared Telegram administrator ID as a substitute for the application's multi-administrator authorization system.

If an administrator lacks permission for a requested action, reject the action safely and return an appropriate localized message.

### 11.7 Database support

Create appropriate database tables or equivalent structures for:

- Administrative users.
- Role definitions.
- Permission definitions.
- User-role relationships.
- User-permission assignments, if supported.
- Invitations.
- Invitation expiration and acceptance status.
- Session or authentication references, as appropriate.
- Administrative audit logs.

Use foreign keys, uniqueness constraints, and appropriate indexes.

Do not store plaintext passwords.

If authentication is managed by an external authentication provider, use its secure identity system and store only the necessary application-specific roles and permissions.

### 11.8 Multi-administrator acceptance tests

Test all of the following:

1. The initial owner can access all authorized features.
2. The owner can invite an additional administrator.
3. The invited administrator can securely accept the invitation.
4. The new administrator can sign in.
5. The owner can grant and revoke permissions.
6. An administrator can perform authorized actions.
7. An administrator cannot perform unauthorized actions.
8. An administrator cannot promote themselves to owner.
9. An administrator cannot create another owner.
10. Suspended or removed administrators lose access.
11. Expired invitations cannot be reused.
12. Unauthorized API requests are rejected even if sent manually.
13. Telegram actions enforce the same permission rules.
14. Administrative actions appear in audit logs.
15. The owner cannot accidentally lose the only means of managing the application.

**Do not consider the multi-administrator feature complete until these tests have been addressed.**

---

## 12. Secure Administration Dashboard

Create a separate, protected administration interface.

For Arabic RTL layouts, use an appropriate right-side collapsible sidebar. For English and Turkish LTR layouts, adapt the interface naturally to the selected direction.

The dashboard must include:

- Orders awaiting confirmation.
- Today's sales.
- Sales over the last seven days.
- Number of active products.
- Recent orders.
- Revenue and order statistics based on actual database records.
- A visible administrative account menu.
- Language selector.
- Permission-aware navigation.
- Access to administrator management for the owner.

Do not show inaccessible features as if the current administrator can use them.

Use permission-aware navigation, but always enforce permissions on the server as well.

### 12.1 Product management

Authorized administrators must be able to:

- Create products.
- Edit products.
- Archive products.
- Delete products when safe.
- Upload and replace product images.
- Configure prices.
- Configure original prices.
- Set discounts.
- Set availability.
- Configure package specifications.
- Manage inventory.
- Assign categories.
- Manage related products.
- Edit Arabic content.
- Edit English content.
- Edit Turkish content.

Prevent destructive deletion of products referenced by historical orders.

Prefer archival or soft deletion when appropriate.

### 12.2 Category management

Support:

- Category creation.
- Category editing.
- Category images.
- Localized category names and descriptions.
- Display ordering.
- Visibility settings.
- Safe deletion.

### 12.3 Banner management

Allow authorized administrators to:

- Upload banner images.
- Set localized titles.
- Set localized descriptive text.
- Link banners to products, categories, or supported destinations.
- Configure visibility.
- Configure display order.
- Set optional start and end dates.

### 12.4 Store settings

Provide editable settings for:

- Store name.
- Store logo.
- Brand colors.
- Tagline.
- Announcement bar.
- Currency display.
- WhatsApp support number.
- Bank transfer instructions.
- Payment method availability.
- Telegram bot configuration status.
- Order acceptance.
- Maintenance mode.
- Customer support information.
- Policies.
- Language-related settings.
- Other relevant storefront configuration.

Provide appropriate translation fields for customer-facing settings.

Use Turkish Lira as the initial currency.

Currency changes must not silently alter historical order amounts.

Implement a global setting to pause new orders while preserving access to existing order tracking and authorized administrative functions.

---

## 13. Progressive Web App (PWA)

Make the storefront installable as a Progressive Web App where supported.

Include:

- A valid web app manifest.
- Appropriate application icons.
- A service worker.
- Secure HTTPS deployment.
- Sensible caching rules.
- A responsive mobile experience.
- Appropriate installation metadata.

Previously loaded public pages and safe static assets may remain available offline.

Display a clear localized offline message.

Disable operations that require a live connection, including:

- Checkout submission.
- Payment verification.
- Inventory assignment.
- Order status updates.
- Administrator permission changes.
- Sensitive account operations.

Do not cache sensitive customer information, payment receipts, administrative pages, activation codes, or private QR delivery assets in the service worker cache.

Ensure that the storefront remains usable in supported mobile browsers.

Test Telegram Mini App behavior separately from standalone PWA installation.

---

## 14. Database and Data Integrity

Use a real persistent database with migrations and appropriate indexes.

Prefer PostgreSQL when supported by the development environment.

Design normalized tables or equivalent structures for:

- Products.
- Product translations.
- Categories.
- Category translations.
- Product images.
- Promotional banners.
- Banner translations.
- Customers.
- Customer identity links.
- Customer language preferences, where needed.
- Orders.
- Order items.
- Payment records.
- Payment receipts.
- Digital inventory.
- Inventory assignments.
- Store settings.
- Localized settings or content.
- Administrative users and roles.
- Permission definitions.
- User-permission assignments.
- Administrative invitations.
- Order status history.
- Administrative audit logs.

Adapt the final schema to the selected authentication provider and architecture.

Use:

- Foreign keys.
- Uniqueness constraints.
- Appropriate indexes.
- Server-side validation.
- Database transactions for critical operations.

Store monetary amounts using an exact decimal representation or integer minor units.

Avoid floating-point calculations for financial totals.

Keep historical order item names, descriptions where needed, and prices as snapshots so later product edits do not rewrite past purchases.

Keep historical order totals and currency values unchanged when store settings or products change.

Provide safe development seed data with clearly marked sample products and no real activation credentials.

Never use production eSIM credentials in test fixtures.

---

## 15. File Storage

Implement secure file storage for:

- Public product images.
- Category images.
- Promotional banners.
- Customer payment receipts.
- Private eSIM delivery assets.

Separate public assets from sensitive private files.

Payment receipts and activation assets must not be publicly accessible through predictable URLs.

Use private storage and authorization-controlled access for sensitive files.

Validate uploads for:

- Allowed file types.
- File size.
- File content where practical.
- Unexpected file extensions.
- Invalid or malicious inputs.

Use secure file access mechanisms, such as short-lived authorized URLs or server-mediated delivery, where appropriate.

Do not expose storage credentials or privileged storage keys to the browser.

Do not log sensitive file contents.

---

## 16. Security Requirements

Apply security controls throughout the application.

Mandatory requirements:

- Server-side authorization for every privileged operation.
- Secure administrative authentication.
- Appropriate session management.
- Password hashing when password-based authentication is used.
- Rate limiting on sensitive endpoints.
- Server-side input validation.
- Output encoding.
- Protection against CSRF where applicable.
- Parameterized database access.
- Safe file upload validation.
- Private storage for sensitive files.
- Strict access controls for receipts, orders, and eSIM inventory.
- HTTPS in production.
- Secure cookies.
- Appropriate security headers.
- Secret management through environment variables or the hosting platform's secret manager.
- Redaction of sensitive information from logs.
- Auditing of administrative actions.
- No default administrator passwords.
- No hardcoded credentials.
- No public database service-role keys.
- No secrets exposed to browser bundles.
- No sensitive payment or activation data in URLs.
- No activation credentials in Telegram notifications.
- Protection against unauthorized role escalation.
- Protection against duplicate payment and order actions.
- Protection against concurrent inventory assignment.

If using Supabase or another managed database platform, configure its access policies appropriately.

Do not rely exclusively on frontend restrictions for database security.

Document a secure process for creating the initial owner account.

Do not create a publicly accessible administrator registration flow.

---

## 17. Privacy and Customer Data

Collect only the customer information necessary for the purchasing and delivery workflow.

Provide clear, localized privacy information.

Restrict customer data access to authorized administrators who need it for their assigned responsibilities.

Do not promise automatic deletion or confidentiality guarantees that the actual system does not implement.

Define a documented retention policy for:

- Customer information.
- Orders.
- Payment receipts.
- Administrative audit logs.
- Digital delivery records.

Where deletion or anonymization is required, implement it consistently with legitimate business, accounting, security, and legal retention requirements.

Do not delete historical records in ways that corrupt order history or financial reporting.

---

## 18. Testing and Quality Assurance

Create and run relevant unit, integration, and end-to-end tests.

Test the following areas.

### Storefront and commerce

- Product display.
- Product search.
- Category navigation.
- Product availability.
- Price calculations.
- Discount calculations.
- Shopping cart behavior.
- Checkout validation.
- Order creation.
- Duplicate submission prevention.
- Order status transitions.
- Customer order access.

### Payment and inventory

- Receipt upload authorization.
- Payment review.
- Payment approval permissions.
- Inventory availability.
- Inventory reservation.
- Concurrent inventory assignment.
- Inventory assignment uniqueness.
- Secure eSIM delivery.
- Protection of QR assets and activation codes.
- Cancellation and reservation cleanup.

### Authentication and administration

- Owner authentication.
- Administrator invitations.
- Invitation expiration.
- Role-based access control.
- Permission changes.
- Unauthorized API requests.
- Administrator suspension.
- Audit logs.
- Administrative session security.
- Prevention of privilege escalation.

### Telegram

- Telegram Mini App initialization-data verification.
- Telegram identity linking.
- Callback authorization.
- Order notifications.
- Customer status notifications.
- Retry handling.
- API failure handling.
- Language-aware messages.

### Localization

- Arabic RTL layout.
- English LTR layout.
- Turkish LTR layout.
- Language switching.
- Language persistence.
- Localized products and categories.
- Localized checkout.
- Localized validation messages.
- Localized Telegram messages.
- Missing-translation fallbacks.

### PWA and responsive behavior

- Installation behavior.
- Offline behavior.
- Safe caching.
- Protection of private information.
- Mobile layout.
- Tablet layout.
- Desktop layout.
- Telegram Mini App behavior.

Use test accounts, fake payment records, and dummy eSIM inventory in development.

Never send real Telegram messages or modify production data during automated tests unless explicitly configured for a controlled test environment.

Do not claim tests passed unless they were actually executed.

Report failures, skipped tests, limitations, and remaining risks honestly.

---

## 19. Implementation Phases

Implement the project in the following phases.

### Phase 1: Architecture and foundation

- Inspect the environment.
- Select the technology stack.
- Set up the repository.
- Configure environment variables.
- Design the database.
- Create migrations.
- Configure storage.
- Set up authentication foundations.
- Create safe development seed data.
- Document the architecture.

### Phase 2: Design system and multilingual storefront

- Build the reusable design system.
- Implement responsive navigation.
- Implement the Arabic, English, and Turkish localization architecture.
- Implement RTL and LTR layouts.
- Build the homepage.
- Build categories.
- Build product listings.
- Build product details.
- Implement search.
- Connect the storefront to the database.

### Phase 3: Cart, checkout, and orders

- Build the shopping cart.
- Implement checkout.
- Implement customer validation.
- Implement server-side pricing.
- Create orders.
- Implement payment method selection.
- Implement secure receipt upload.
- Implement order confirmation.
- Implement customer order tracking.

### Phase 4: Authentication and administration

- Build the protected administration dashboard.
- Implement authentication and authorization.
- Implement the owner role.
- Implement additional administrator invitations.
- Implement role-based permissions.
- Implement audit logs.
- Build product management.
- Build category management.
- Build banner management.
- Build store settings.
- Implement localized content management.

### Phase 5: Manual eSIM inventory and delivery

- Implement digital inventory management.
- Implement inventory availability and reservation.
- Implement atomic inventory assignment.
- Implement payment review.
- Implement approval workflows.
- Implement secure delivery.
- Implement delivery history.
- Implement cancellation and relevant inventory recovery rules.

### Phase 6: Telegram bot and Mini App

- Configure Telegram integration.
- Implement the bot start flow.
- Implement the Mini App.
- Verify Telegram initialization data.
- Implement administrator notifications.
- Implement authorized callback actions.
- Implement customer status notifications.
- Implement multilingual Telegram messaging.
- Integrate Telegram administrative actions with the permission system.

### Phase 7: PWA, accessibility, and performance

- Implement the web app manifest.
- Implement the service worker.
- Configure safe caching.
- Implement offline messages.
- Optimize images and loading.
- Improve accessibility.
- Review mobile layouts.
- Review SEO.
- Test all three languages.

### Phase 8: Security, testing, and deployment

- Run the relevant automated tests.
- Review authentication and authorization.
- Review file storage security.
- Review database access policies.
- Test concurrent inventory operations.
- Test administrative permissions.
- Test Telegram authorization.
- Fix discovered regressions.
- Prepare deployment instructions.
- Document environment variables.
- Document migrations.
- Document backups and recovery.
- Run production smoke tests where the environment permits.

For each phase:

1. State the objective.
2. Define acceptance criteria.
3. Identify the affected files and database changes.
4. Implement the functionality.
5. Run the relevant tests.
6. Inspect the results.
7. Fix discovered regressions.
8. Report completed functionality and remaining limitations.
9. Stop before proceeding to the next phase if approval is required.

Do not mark a phase complete merely because its interface has been created.

---

## 20. Deployment and Maintenance

Prepare the application for deployment to the hosting environment selected after inspecting the available tools.

Document:

- Required runtime versions.
- Required environment variables.
- Database configuration.
- Migration commands.
- Initial owner account creation.
- Storage configuration.
- Telegram bot setup.
- Domain and HTTPS configuration.
- Production build and deployment steps.
- Backup procedures.
- Recovery procedures.
- Logging and monitoring.
- Updating the application.
- Rotating credentials.
- Managing administrator access.
- Testing after deployment.

Do not assume that the chosen hosting platform supports every feature.

Verify compatibility before selecting platform-specific services.

Never expose secrets in source control or deployment logs.

---

## 21. Final Acceptance Criteria

The project is not complete simply because the homepage looks finished.

Completion requires all of the following:

### Storefront
- A responsive, database-driven e-commerce website.
- Functional product and category management.
- Working search.
- Working shopping cart.
- Working checkout.
- Correct server-side price calculations.
- Correct order and payment status handling.

### Languages
- Complete Arabic, English, and Turkish interface support.
- Correct Arabic RTL layout.
- Correct English and Turkish LTR layouts.
- Language persistence.
- Localized product and category content.
- Localized checkout, tracking, and customer messages.
- Localized Telegram communication.

### eSIM operations
- Manual inventory management.
- Safe stock reservation.
- Transaction-safe inventory assignment.
- Payment approval workflow.
- Secure delivery.
- Protection of activation codes and QR assets.

### Administration
- Protected administration dashboard.
- Owner account with full authorized control.
- Ability to add additional administrators.
- Role-based permissions.
- Server-side authorization.
- Ability to suspend and revoke administrative access.
- Audit logs.
- Secure Telegram administrative actions.

### Platform
- Working Telegram bot integration.
- Working Telegram Mini App.
- Verified Telegram identity and callback authorization.
- Installable PWA where supported.
- Safe offline behavior.
- Persistent database.
- Secure file storage.
- Relevant automated tests.
- Deployment documentation.
- Backup and recovery procedures.

Do not silently omit requirements.

If a feature cannot be completed because of missing credentials, unsupported infrastructure, or another genuine limitation, explain exactly what is missing and what must be configured.

Do not pretend that integrations are working when they have not been tested.

## 22. Final Instructions to the Development Agent

Begin by inspecting the development environment and producing the architecture proposal and phased implementation plan.

Then implement the project systematically.

Prioritize security, correctness, maintainability, and real functionality over superficial appearance.

Keep the storefront visually polished and consistent with the 4AB NET brand.

Ensure that all customer-facing content can be managed in Arabic, English, and Turkish.

Ensure that the owner can add and manage additional administrators without surrendering ownership or critical security controls.

Ensure that every sensitive operation is protected by server-side authentication and authorization.

Do not expose eSIM credentials, payment receipts, customer data, database secrets, or administrative credentials publicly.

Do not invent product specifications, payment confirmations, API credentials, or test results.

The final result must be a coherent, maintainable, secure, multilingual e-commerce platform for selling eSIM internet packages, with manual inventory and delivery, a Telegram integration, a PWA, and a complete multi-administrator system.