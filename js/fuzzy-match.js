/**
 * @fileoverview Fuzzy Matching Library - Name correction using Levenshtein distance
 * @module fuzzy-match
 * @description Finds closest matching student names from roster using edit distance
 */

(function() {
    'use strict';

    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Edit distance
     */
    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];

        // Initialize first column
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        // Initialize first row
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        // Fill in the rest
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    /**
     * Calculate similarity score (0-1, higher is better)
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Similarity score
     */
    function similarity(a, b) {
        const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
        const maxLength = Math.max(a.length, b.length);
        return maxLength === 0 ? 1.0 : 1.0 - (distance / maxLength);
    }

    /**
     * Find best matching student from roster
     * @param {string} inputName - Name to match
     * @param {Array<{name: string, grade: string}>} roster - Student roster
     * @param {number} threshold - Minimum similarity threshold (0-1), default 0.6
     * @returns {{student: Object, score: number} | null} Best match or null
     */
    function findBestMatch(inputName, roster, threshold = 0.6) {
        if (!inputName || !roster || roster.length === 0) {
            return null;
        }

        let bestMatch = null;
        let bestScore = threshold;

        for (const student of roster) {
            const score = similarity(inputName, student.name);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = student;
            }
        }

        return bestMatch ? { student: bestMatch, score: bestScore } : null;
    }

    /**
     * Find all matches above threshold
     * @param {string} inputName - Name to match
     * @param {Array<{name: string, grade: string}>} roster - Student roster
     * @param {number} threshold - Minimum similarity threshold (0-1), default 0.5
     * @param {number} limit - Maximum number of results, default 5
     * @returns {Array<{student: Object, score: number}>} Matches sorted by score
     */
    function findMatches(inputName, roster, threshold = 0.5, limit = 5) {
        if (!inputName || !roster || roster.length === 0) {
            return [];
        }

        const matches = [];

        for (const student of roster) {
            const score = similarity(inputName, student.name);

            if (score >= threshold) {
                matches.push({ student, score });
            }
        }

        // Sort by score descending
        matches.sort((a, b) => b.score - a.score);

        // Limit results
        return matches.slice(0, limit);
    }

    /**
     * Find students by grade
     * @param {string} grade - Grade to find
     * @param {Array<{name: string, grade: string}>} roster - Student roster
     * @returns {Array<Object>} Students in that grade
     */
    function findByGrade(grade, roster) {
        if (!grade || !roster) {
            return [];
        }

        return roster.filter(student =>
            student.grade.toLowerCase() === grade.toLowerCase()
        );
    }

    /**
     * Search students by name prefix
     * @param {string} prefix - Name prefix to search
     * @param {Array<{name: string, grade: string}>} roster - Student roster
     * @param {number} limit - Maximum number of results, default 10
     * @returns {Array<Object>} Matching students
     */
    function searchByPrefix(prefix, roster, limit = 10) {
        if (!prefix || !roster) {
            return [];
        }

        const lowerPrefix = prefix.toLowerCase();
        const matches = roster.filter(student =>
            student.name.toLowerCase().startsWith(lowerPrefix)
        );

        return matches.slice(0, limit);
    }

    /**
     * Auto-correct name and grade from voice transcript
     * @param {string} inputName - Transcribed name
     * @param {string|null} inputGrade - Transcribed grade (optional)
     * @param {Array<{name: string, grade: string}>} roster - Student roster
     * @returns {{corrected: Object, confidence: number} | null} Corrected student or null
     */
    function autoCorrect(inputName, inputGrade, roster) {
        if (!inputName || !roster || roster.length === 0) {
            return null;
        }

        // If grade provided, narrow down search
        let searchRoster = roster;
        if (inputGrade) {
            const gradeMatches = findByGrade(inputGrade, roster);
            if (gradeMatches.length > 0) {
                searchRoster = gradeMatches;
            }
        }

        // Find best match
        const result = findBestMatch(inputName, searchRoster, 0.6);

        if (result) {
            return {
                corrected: result.student,
                confidence: result.score
            };
        }

        return null;
    }

    // Export public API
    window.FuzzyMatch = {
        findBestMatch,
        findMatches,
        findByGrade,
        searchByPrefix,
        autoCorrect,
        similarity,
        levenshteinDistance
    };

    console.log('Fuzzy match library loaded');

})();
