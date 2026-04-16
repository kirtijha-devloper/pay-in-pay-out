"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branchx_controller_1 = require("../controllers/branchx.controller");
const router = (0, express_1.Router)();
router.route('/').get(branchx_controller_1.handleBranchxPayoutCallback).post(branchx_controller_1.handleBranchxPayoutCallback);
exports.default = router;
