import account from "./account.json";
import activity from "./activity.json";
import analytics from "./analytics.json";
import auth from "./auth.json";
import bookings from "./bookings.json";
import branches from "./branches.json";
import common from "./common.json";
import dashboard from "./dashboard.json";
import errors from "./errors.json";
import nav from "./nav.json";
import orders from "./orders.json";
import permissions from "./permissions.json";
import products from "./products.json";
import services from "./services.json";
import showroom from "./showroom.json";
import users from "./users.json";
import validation from "./validation.json";

const messages = {
  Account: account,
  Activity: activity,
  Analytics: analytics,
  Auth: auth,
  Branches: branches,
  Common: common,
  Dashboard: dashboard,
  Errors: errors,
  Nav: nav,
  Orders: orders,
  Permissions: permissions,
  Products: products,
  Services: services,
  Showroom: showroom,
  Users: users,
  Validation: validation,
  ...bookings,
};

export default messages;
