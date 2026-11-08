const express = require('express');
const router = express.Router();
const {
  getSessions,
  getUpcomingSessions,
  getSession,
  createSession,
  updateSession,
  cancelSession,
  startSession,
  completeSession,
  saveSoapNote,
  finalizeSoapNote,
  addSoapAddendum,
  generateSoapNoteOnDemand,
  saveTranscript,
  getTranscriptTranslation,
  recordAttendance,
  getOutstandingDocumentation,
} = require('../controllers/sessionController');
const { protect } = require('../middlewares/auth');
const { isTherapist } = require('../middlewares/roleCheck');

// All session routes require authentication
router.use(protect);

// Routes accessible to both therapist and client
router.get('/', getSessions);
router.get('/upcoming', getUpcomingSessions);
router.get('/outstanding', isTherapist, getOutstandingDocumentation);
router.get('/:id', getSession);

// Session creation - Both therapist and client can create (booking)
router.post('/', createSession);
router.put('/:id', updateSession);  // Either role can update (for cancellation)
router.delete('/:id', cancelSession);  // Either role can cancel their own sessions

// Session actions
router.post('/:id/start', startSession);
router.post('/:id/complete', isTherapist, completeSession);
router.post('/:id/soap-note', isTherapist, saveSoapNote);
router.post('/:id/soap-note/finalize', isTherapist, finalizeSoapNote);
router.post('/:id/soap-note/addendum', addSoapAddendum);
router.post('/:id/generate-soap', isTherapist, generateSoapNoteOnDemand);
router.post('/:id/attendance', isTherapist, recordAttendance);

// Transcript routes
router.post('/:id/transcript', protect, saveTranscript);
router.get('/:id/transcript/:language', protect, getTranscriptTranslation);

module.exports = router;

